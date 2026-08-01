import { db } from '../utils/db'
import { users, follows, notifications } from '../db/schema'
import { eq } from 'drizzle-orm'
import { actorUrl } from '../utils/ap/activitypub'

export default eventHandler(async (event) => {
    const { userid, targetUsername } = await readBody(event)
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

    await db.insert(follows).values({
        userid: target.id,
        followerActorUrl,
        followerInbox: `${followerActorUrl}/inbox`,
        followerUserId: follower.id,
        accepted: true,
    }).onConflictDoUpdate({
        target: [follows.userid, follows.followerActorUrl],
        set: { accepted: true, followerUserId: follower.id },
    })

    await db.insert(notifications).values({
        userid: target.id,
        type: 'follow',
        actorUserId: follower.id,
    })

    return { ok: true }
})
