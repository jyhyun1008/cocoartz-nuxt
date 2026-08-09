import { db } from '../utils/db'
import { chats, users, chatReactions } from '../db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter, getWordMuteLookup, applyWordMuteFilter, getEmojiMuteLookup, filterMutedReactions } from '../utils/mutes'

// 방 하나에 몇 달치 채팅이 쌓이면 매번 그 방을 열 때마다 전체 이력을 통째로(정렬 기준도 없이!)
// 다시 내려주고 있었음 — 서버 쿼리 비용도 크고, 클라이언트가 그 전체를 메모리에 들고 있어야
// 해서 자산이 컸음. 최근 N개만 내려주는 걸로 바꿈(과거 메시지를 더 불러오는 UI는 아직 없어서,
// 그 이전 메시지는 지금은 아예 안 보임 — 필요하면 나중에 "이전 메시지 더보기"를 따로 추가할 것)
const CHAT_HISTORY_LIMIT = 200

export default eventHandler(async (event) => {
    const { serverid, roomid, userid } = await readBody(event)
    let results = await db.select().from(chats).where(
        and(eq(chats.serverid, serverid), eq(chats.roomid, roomid))
    ).orderBy(desc(chats.createdAt)).limit(CHAT_HISTORY_LIMIT)
    results.reverse()  // 화면엔 과거→최신 순으로 보여야 하니 다시 뒤집음

    const muteLookup = await getMuteLookup(userid)
    results = applyMuteFilter(results, muteLookup, (c) => ({ userid: c.userid }))
    const wordMuteLookup = await getWordMuteLookup(userid)
    results = applyWordMuteFilter(results, wordMuteLookup, (c) => c.content)
    const emojiMuteLookup = await getEmojiMuteLookup(userid)
    results = applyWordMuteFilter(results, emojiMuteLookup, (c) => c.content)

    // 메시지 하나마다 유저 조회를 따로 날리던 걸(N+1) 한 번의 배치 조회로 합침
    if (results.length) {
        const userIds = [...new Set(results.map(r => r.userid))]
        const userRows = await db.select().from(users).where(inArray(users.id, userIds))
        const userById = new Map(userRows.map(u => [u.id, u]))
        for (const result of results) {
            ;(result as any).user = userById.get(result.userid)
        }
    }

    if (results.length) {
        const allReactions = await db.select().from(chatReactions).where(
            inArray(chatReactions.chatid, results.map(r => r.id))
        )
        const byChat: Record<number, Record<string, { count: number; reacted: boolean }>> = {}
        for (const r of allReactions) {
            const map = byChat[r.chatid] ??= {}
            if (!map[r.emoji]) map[r.emoji] = { count: 0, reacted: false }
            map[r.emoji].count++
            if (r.userid === userid) map[r.emoji].reacted = true
        }
        for (const result of results) {
            const map = byChat[result.id] ?? {}
            ;(result as any).reactions = filterMutedReactions(
                Object.entries(map).map(([emoji, data]) => ({ emoji, ...data })),
                emojiMuteLookup.shortcodes,
            )
        }
    }

    return results
})
