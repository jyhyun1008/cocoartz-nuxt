import { db } from '../utils/db'
import { chatReactions } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { chatid, userid, emoji } = await readBody(event)

    const existing = await db.select().from(chatReactions).where(
        and(eq(chatReactions.chatid, chatid), eq(chatReactions.userid, userid), eq(chatReactions.emoji, emoji))
    )

    if (existing.length > 0) {
        await db.delete(chatReactions).where(
            and(eq(chatReactions.chatid, chatid), eq(chatReactions.userid, userid), eq(chatReactions.emoji, emoji))
        )
        return { reacted: false }
    }

    await db.insert(chatReactions).values({ chatid, userid, emoji })
    return { reacted: true }
})
