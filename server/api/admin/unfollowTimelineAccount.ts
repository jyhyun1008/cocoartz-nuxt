import { db } from '../../utils/db'
import { users, timelineFollows } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { ensureTimelineActor } from '../../utils/ap/ensureTimelineActor'
import { buildFollowActivity, buildUndoActivity, timelineActorUrl } from '../../utils/ap/activitypub'
import { deliverToInbox } from '../../utils/ap/deliver'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { userid, id } = await readBody(event)
    await checkAdmin(userid)

    const [follow] = await db.select().from(timelineFollows).where(eq(timelineFollows.id, id))
    if (!follow) throw createError({ statusCode: 404, message: '팔로우 정보를 찾을 수 없습니다' })

    const config = useRuntimeConfig()
    const domain = config.domain as string
    const timelineActor = await ensureTimelineActor()

    if (timelineActor) {
        const actorId = timelineActorUrl(domain)
        const originalFollow = buildFollowActivity(actorId, follow.targetActorUrl)
        originalFollow.id = follow.followActivityId ?? originalFollow.id
        const undo = buildUndoActivity(actorId, originalFollow)
        await deliverToInbox(follow.targetInbox, undo, actorId, timelineActor.privateKey)
            .catch((e) => console.error('[unfollowTimelineAccount] Undo 전송 실패', e))
    }

    await db.delete(timelineFollows).where(eq(timelineFollows.id, id))
    return { ok: true }
})
