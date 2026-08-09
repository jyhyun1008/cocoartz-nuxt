import { db } from '../utils/db'
import { follows, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, buildAcceptActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'
import { requireUserId } from '../utils/session'

// 수동 승인 대기 중인 팔로우 요청 승인 — 로컬 요청은 그냥 accepted만 켜면 되고, 원격 요청은
// 상대 서버에 Accept를 보내야 그쪽 클라이언트에서도 "팔로잉 중"으로 인식함
export default eventHandler(async (event) => {
    const { followId } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const [row] = await db.select().from(follows).where(eq(follows.id, followId))
    if (!row || row.userid !== userid) throw createError({ statusCode: 404, message: '요청을 찾을 수 없습니다' })

    await db.update(follows).set({ accepted: true }).where(eq(follows.id, followId))

    if (!row.followerUserId) {
        const [user] = await db.select().from(users).where(eq(users.id, userid))
        const actor = await ensureActor(userid)
        if (user && actor) {
            const config = useRuntimeConfig()
            const domain = config.domain as string
            const myActorId = actorUrl(domain, user.username)
            // 원본 Follow 액티비티 전체를 저장해두진 않아서, Accept가 참조할 수 있는 최소 형태로 재구성
            // (상대 서버는 대부분 id/actor만으로 자기가 보낸 Follow와 매칭함)
            const followActivity = {
                id: row.followActivityId,
                type: 'Follow',
                actor: row.followerActorUrl,
                object: myActorId,
            }
            const accept = buildAcceptActivity(domain, user.username, followActivity)
            await deliverToInbox(row.followerInbox, accept, myActorId, actor.privateKey)
                .catch((e) => console.error('[approveFollow] Accept 전송 실패', e))
        }
    }

    return { ok: true }
})
