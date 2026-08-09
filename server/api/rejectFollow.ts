import { db } from '../utils/db'
import { follows, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, buildRejectActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'
import { requireUserId } from '../utils/session'

// 수동 승인 대기 중인 팔로우 요청 거절 — 원격 요청이면 상대 서버에 Reject를 보내고, 로컬이든
// 원격이든 대기 행 자체는 삭제(다시 요청하면 새로 대기 상태로 쌓임)
export default eventHandler(async (event) => {
    const { followId } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const [row] = await db.select().from(follows).where(eq(follows.id, followId))
    if (!row || row.userid !== userid) throw createError({ statusCode: 404, message: '요청을 찾을 수 없습니다' })

    if (!row.followerUserId) {
        const [user] = await db.select().from(users).where(eq(users.id, userid))
        const actor = await ensureActor(userid)
        if (user && actor) {
            const config = useRuntimeConfig()
            const domain = config.domain as string
            const myActorId = actorUrl(domain, user.username)
            const followActivity = {
                id: row.followActivityId,
                type: 'Follow',
                actor: row.followerActorUrl,
                object: myActorId,
            }
            const reject = buildRejectActivity(domain, user.username, followActivity)
            await deliverToInbox(row.followerInbox, reject, myActorId, actor.privateKey)
                .catch((e) => console.error('[rejectFollow] Reject 전송 실패', e))
        }
    }

    await db.delete(follows).where(eq(follows.id, followId))

    return { ok: true }
})
