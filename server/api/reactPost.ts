import { db } from '../utils/db'
import { reactions } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { postid, userid, emoji } = await readBody(event)

    const existing = await db.select().from(reactions).where(
        and(eq(reactions.postid, postid), eq(reactions.userid, userid), eq(reactions.emoji, emoji))
    )

    if (existing.length > 0) {
        await db.delete(reactions).where(
            and(eq(reactions.postid, postid), eq(reactions.userid, userid), eq(reactions.emoji, emoji))
        )
        return { reacted: false }
    }

    await db.insert(reactions).values({ postid, userid, emoji })
    return { reacted: true }
})
