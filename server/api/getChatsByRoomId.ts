import { db } from '../utils/db'
import { chats, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { serverid, roomid } = await readBody(event)
    const results = await db.select().from(chats).where(
        and(eq(chats.serverid, serverid), eq(chats.roomid, roomid))
    )
    for (const result of results) {
        const userinfo = await db.select().from(users).where(eq(users.id, result.userid))
        ;(result as any).user = userinfo[0]
    }
    return results
})
