import { db } from './db'
import { mutes } from '../db/schema'
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
