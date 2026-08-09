import { db } from '../utils/db'
import { users, follows, notifications } from '../db/schema'
import { eq } from 'drizzle-orm'
import { actorUrl } from '../utils/ap/activitypub'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { targetUsername } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!targetUsername) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })

    const [follower] = await db.select().from(users).where(eq(users.id, userid))
    if (!follower) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const [target] = await db.select().from(users).where(eq(users.username, targetUsername))
    if (!target) throw createError({ statusCode: 404, message: '존재하지 않는 유저입니다' })
    if (target.id === follower.id) throw createError({ statusCode: 400, message: '자기 자신은 팔로우할 수 없습니다' })

    const config = useRuntimeConfig()
    const domain = config.domain as string
    const followerActorUrl = actorUrl(domain, follower.username)

    // 대상이 "팔로우 수동 승인"을 켜뒀으면 대기 상태(accepted:false)로 쌓아두고 본인이 직접 승인해야 함
    const accepted = !target.requireFollowApproval

    await db.insert(follows).values({
        userid: target.id,
        followerActorUrl,
        followerInbox: `${followerActorUrl}/inbox`,
        followerUserId: follower.id,
        accepted,
    }).onConflictDoUpdate({
        target: [follows.userid, follows.followerActorUrl],
        // accepted는 여기서 안 건드림 — 이미 대기 중인 요청을 재시도한다고 자동으로 승인 처리되면 안 됨
        set: { followerUserId: follower.id },
    })

    await db.insert(notifications).values({
        userid: target.id,
        type: 'follow',
        actorUserId: follower.id,
    })

    return { ok: true, accepted }
})
