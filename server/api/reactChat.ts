import { db } from '../utils/db'
import { chatReactions } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { chatid, emoji } = await readBody(event)
    const userid = await requireUserId(event)
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
