import { db } from '../utils/db'
import { chats, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { serverid, roomid, content } = await readBody(event)
    const userid = await requireUserId(event)
    const [chat] = await db.insert(chats).values({ serverid, roomid, userid, content }).returning()
    const [user] = await db.select().from(users).where(eq(users.id, userid))
    return { ...chat, user }
})
