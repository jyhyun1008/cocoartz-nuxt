import { db } from '../utils/db'
import { mutes } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { targetUserId, targetActorUrl } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    if (targetUserId) {
        await db.delete(mutes).where(and(eq(mutes.userid, userid), eq(mutes.targetUserId, targetUserId)))
    } else if (targetActorUrl) {
        await db.delete(mutes).where(and(eq(mutes.userid, userid), eq(mutes.targetActorUrl, targetActorUrl)))
    }

    return { ok: true }
})
