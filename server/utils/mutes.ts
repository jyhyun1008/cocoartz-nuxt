import { db } from './db'
import { mutes, wordMutes, emojiMutes } from '../db/schema'
import { eq } from 'drizzle-orm'

export type MuteLevel = 'soft' | 'hard'

// 각 read API에서 반복 사용하는 뮤트 조회 — viewerUserId가 뮤트해둔 대상(로컬 userid 또는
// 원격 actorUrl)에 대해 level('soft'|'hard')을 즉시 조회할 수 있는 조회 함수를 돌려줌.
// 로그인 안 했으면(viewerUserId 없음) 항상 null(뮤트 없음)을 반환하는 no-op으로 처리
export async function getMuteLookup(viewerUserId: number | null | undefined) {
    if (!viewerUserId) {
        return { levelOf: () => null as MuteLevel | null }
    }

    const rows = await db.select().from(mutes).where(eq(mutes.userid, viewerUserId))
    const byUser = new Map(rows.filter(r => r.targetUserId != null).map(r => [r.targetUserId as number, r.level as MuteLevel]))
    const byActor = new Map(rows.filter(r => r.targetActorUrl).map(r => [r.targetActorUrl as string, r.level as MuteLevel]))

    return {
        levelOf({ userid, actorUrl }: { userid?: number | null; actorUrl?: string | null }): MuteLevel | null {
            if (userid != null && byUser.has(userid)) return byUser.get(userid)!
            if (actorUrl && byActor.has(actorUrl)) return byActor.get(actorUrl)!
            return null
        },
    }
}

// rows 배열에 뮤트 필터를 적용 — hard면 제거, soft면 muted:'soft' 필드만 붙임.
// getAuthor(row)는 { userid?, actorUrl? }를 반환해야 함(로컬글은 userid, 원격글/원격답글은 actorUrl)
export function applyMuteFilter<T extends Record<string, any>>(
    rows: T[],
    lookup: { levelOf: (author: { userid?: number | null; actorUrl?: string | null }) => MuteLevel | null },
    getAuthor: (row: T) => { userid?: number | null; actorUrl?: string | null },
): T[] {
    const result: T[] = []
    for (const row of rows) {
        const level = lookup.levelOf(getAuthor(row))
        if (level === 'hard') continue
        if (level === 'soft') (row as any).muted = 'soft'
        result.push(row)
    }
    return result
}

// 계정 뮤트(위)와 별개로, 글/댓글/채팅 "내용"에 등록해둔 단어/정규식이 매치되면 작성자가 누구든
// 걸리는 개인별 콘텐츠 뮤트. 일반 단어는 대소문자 무시 부분일치, 정규식은 사용자가 입력한 그대로
// (역시 대소문자 무시) 컴파일해서 검사 — 잘못된 정규식이나 등록 이후 깨질 수 있는 패턴은 그
// 규칙만 무시하고 나머지는 계속 동작하게 함(요청 전체가 죽으면 안 되니)
export async function getWordMuteLookup(viewerUserId: number | null | undefined) {
    if (!viewerUserId) {
        return { levelOf: () => null as MuteLevel | null }
    }

    const rows = await db.select().from(wordMutes).where(eq(wordMutes.userid, viewerUserId))
    const rules = rows.map((r) => {
        try {
            const source = r.isRegex ? r.pattern : r.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            return { level: r.level as MuteLevel, regex: new RegExp(source, 'i') }
        } catch {
            return null
        }
    }).filter((r): r is { level: MuteLevel; regex: RegExp } => r !== null)

    return {
        levelOf(text: string | null | undefined): MuteLevel | null {
            if (!text || !rules.length) return null
            let softMatch = false
            for (const rule of rules) {
                if (rule.regex.test(text)) {
                    if (rule.level === 'hard') return 'hard'
                    softMatch = true
                }
            }
            return softMatch ? 'soft' : null
        },
    }
}

// applyMuteFilter와 동일한 모양이지만 대상이 작성자가 아니라 텍스트 — 두 필터는 같은 rows 배열에
// 순서대로 이어붙여 써도 안전함(둘 다 hard면 제거, soft면 muted 필드를 덮어쓰기만 하므로 먼저
// 걸린 soft가 사라지지 않음. hard가 하나라도 있으면 그 시점에 걸러짐)
export function applyWordMuteFilter<T extends Record<string, any>>(
    rows: T[],
    lookup: { levelOf: (text: string | null | undefined) => MuteLevel | null },
    getText: (row: T) => string | null | undefined,
): T[] {
    const result: T[] = []
    for (const row of rows) {
        const level = lookup.levelOf(getText(row))
        if (level === 'hard') continue
        if (level === 'soft') (row as any).muted = 'soft'
        result.push(row)
    }
    return result
}

// 커스텀 이모지(:shortcode:) 개인 뮤트 — 단어 뮤트처럼 유저가 soft/hard를 고르게 하지 않고
// 맥락별로 동작을 고정함(shortcodes 자체를 돌려줘서 호출부가 둘 다 활용):
// - 글/댓글/위키/채팅 "본문"에 그 이모지가 쓰였으면 → 항상 soft(위 applyWordMuteFilter를 그대로
//   재사용할 수 있도록 같은 {levelOf(text)} 모양으로 맞춤)
// - 리액션 목록에 그 이모지가 달려있으면 → 아예 목록에서 제외(아래 filterMutedReactions)
export async function getEmojiMuteLookup(viewerUserId: number | null | undefined) {
    if (!viewerUserId) {
        return { shortcodes: new Set<string>(), levelOf: () => null as MuteLevel | null }
    }

    const rows = await db.select({ shortcode: emojiMutes.shortcode }).from(emojiMutes).where(eq(emojiMutes.userid, viewerUserId))
    const shortcodes = new Set(rows.map((r) => r.shortcode))

    return {
        shortcodes,
        levelOf(text: string | null | undefined): MuteLevel | null {
            if (!text || !shortcodes.size) return null
            for (const code of shortcodes) {
                if (text.includes(`:${code}:`)) return 'soft'
            }
            return null
        },
    }
}

// 리액션 목록(emoji가 유니코드 문자 그대로거나 커스텀 이모지는 ":shortcode:" 형태로 저장됨)에서
// 뮤트해둔 커스텀 이모지 리액션만 통째로 제외 — 리액션 한 알을 "그래도 보기" 게이트로 가리는 건
// UX상 어색해서 소프트 단계 없이 아예 안 보이는 단계 하나만 둠
export function filterMutedReactions<T extends { emoji: string }>(list: T[], shortcodes: Set<string>): T[] {
    if (!shortcodes.size) return list
    return list.filter((r) => {
        const m = r.emoji.match(/^:(.+):$/)
        return !(m && shortcodes.has(m[1]))
    })
}
