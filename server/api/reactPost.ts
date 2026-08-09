import { db } from '../utils/db'
import { reactions } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { postid, emoji } = await readBody(event)
    const userid = await requireUserId(event)
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
