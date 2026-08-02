import { db } from '../utils/db'
import { chats, users, chatReactions } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { serverid, roomid, userid } = await readBody(event)
    const results = await db.select().from(chats).where(
        and(eq(chats.serverid, serverid), eq(chats.roomid, roomid))
    )
    for (const result of results) {
        const userinfo = await db.select().from(users).where(eq(users.id, result.userid))
        ;(result as any).user = userinfo[0]
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
            ;(result as any).reactions = Object.entries(map).map(([emoji, data]) => ({ emoji, ...data }))
        }
    }

    return results
})
