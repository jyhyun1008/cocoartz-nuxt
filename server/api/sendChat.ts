import { db } from '../utils/db'
import { chats, users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { serverid, roomid, userid, content } = await readBody(event)
    const [chat] = await db.insert(chats).values({ serverid, roomid, userid, content }).returning()
    const [user] = await db.select().from(users).where(eq(users.id, userid))
    return { ...chat, user }
})
