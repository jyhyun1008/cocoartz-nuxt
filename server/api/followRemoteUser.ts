import { db } from '../utils/db'
import { users, remoteFollows } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { resolveWebfinger, fetchActor, buildFollowActivity, actorUrl, buildActorDisplayInfo } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'

export default eventHandler(async (event) => {
    const { userid, handle } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const [user] = await db.select().from(users).where(eq(users.id, userid))
    if (!user) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const cleanHandle = String(handle || '').trim().replace(/^@/, '')
    if (!cleanHandle.includes('@')) {
        throw createError({ statusCode: 400, message: '핸들 형식이 올바르지 않습니다 (예: user@mastodon.social)' })
    }

    const config = useRuntimeConfig()
    const domain = config.domain as string

    const targetActorUrl = await resolveWebfinger(cleanHandle)
    if (!targetActorUrl) throw createError({ statusCode: 404, message: '계정을 찾을 수 없습니다' })

    const existing = await db.select().from(remoteFollows)
        .where(eq(remoteFollows.userid, userid))
    if (existing.some(f => f.targetActorUrl === targetActorUrl)) {
        throw createError({ statusCode: 400, message: '이미 팔로우 중인 계정입니다' })
    }

    const actorData = await fetchActor(targetActorUrl)
    if (!actorData) throw createError({ statusCode: 404, message: '계정 정보를 가져올 수 없습니다' })

    const inboxUrl = (actorData.endpoints as Record<string, string> | undefined)?.sharedInbox
        || actorData.inbox as string
    if (!inboxUrl) throw createError({ statusCode: 400, message: '이 계정은 inbox가 없습니다' })

    const info = buildActorDisplayInfo(actorData, targetActorUrl)
    // preferredUsername이 없는 드문 경우엔 서버에서 만든 핸들 대신 유저가 직접 입력한 핸들을 그대로 씀
    const targetHandle = info.handle || `@${cleanHandle}`

    const actor = await ensureActor(userid)
    if (!actor) throw createError({ statusCode: 500, message: '액터 생성 실패' })

    const myActorId = actorUrl(domain, user.username)
    const follow = buildFollowActivity(myActorId, targetActorUrl)

    const [row] = await db.insert(remoteFollows).values({
        userid,
        targetActorUrl,
        targetInbox: inboxUrl,
        targetHandle,
        targetName: info.name,
        targetIconUrl: info.iconUrl,
        remoteActorCachedAt: new Date(),
        accepted: false,
        followActivityId: follow.id,
    }).returning()

    const delivered = await deliverToInbox(inboxUrl, follow, myActorId, actor.privateKey)
    if (!delivered) {
        await db.delete(remoteFollows).where(eq(remoteFollows.id, row.id))
        throw createError({ statusCode: 502, message: '상대 서버로 팔로우 요청 전송에 실패했습니다. 잠시 후 다시 시도해주세요' })
    }

    return row
})
