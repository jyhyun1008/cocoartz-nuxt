import { db } from '../utils/db'
import { users, remoteFollows } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, buildFollowActivity, buildUndoActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'

export default eventHandler(async (event) => {
    const { userid, id } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const [follow] = await db.select().from(remoteFollows).where(eq(remoteFollows.id, id))
    if (!follow || follow.userid !== userid) {
        throw createError({ statusCode: 404, message: '팔로우 정보를 찾을 수 없습니다' })
    }

    const [user] = await db.select().from(users).where(eq(users.id, userid))
    const actor = await ensureActor(userid)

    if (user && actor) {
        const config = useRuntimeConfig()
        const domain = config.domain as string
        const myActorId = actorUrl(domain, user.username)
        const originalFollow = buildFollowActivity(myActorId, follow.targetActorUrl)
        originalFollow.id = follow.followActivityId ?? originalFollow.id
        const undo = buildUndoActivity(myActorId, originalFollow)
        // 언팔로우는 상대에게 Undo 전송이 실패해도 로컬에서는 항상 성공해야 함(계속 팔로우 상태로 갇히면 안 됨)
        // deliverToInbox는 내부에서 예외를 삼키고 boolean만 반환하므로 결과만 로그로 남김
        const delivered = await deliverToInbox(follow.targetInbox, undo, myActorId, actor.privateKey)
        if (!delivered) console.warn('[unfollowRemoteUser] Undo 전송 실패, 로컬 팔로우는 그대로 해제')
    }

    await db.delete(remoteFollows).where(eq(remoteFollows.id, id))
    return { ok: true }
})
