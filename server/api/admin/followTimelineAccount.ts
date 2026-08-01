import { db } from '../../utils/db'
import { users, timelineFollows } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { ensureTimelineActor } from '../../utils/ap/ensureTimelineActor'
import { resolveWebfinger, fetchActor, buildFollowActivity, timelineActorUrl } from '../../utils/ap/activitypub'
import { deliverToInbox } from '../../utils/ap/deliver'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { userid, handle } = await readBody(event)
    await checkAdmin(userid)

    const cleanHandle = String(handle || '').trim().replace(/^@/, '')
    if (!cleanHandle.includes('@')) {
        throw createError({ statusCode: 400, message: '핸들 형식이 올바르지 않습니다 (예: user@mastodon.social)' })
    }

    const config = useRuntimeConfig()
    const domain = config.domain as string

    const targetActorUrl = await resolveWebfinger(cleanHandle)
    if (!targetActorUrl) throw createError({ statusCode: 404, message: '계정을 찾을 수 없습니다' })

    const existing = await db.select().from(timelineFollows).where(eq(timelineFollows.targetActorUrl, targetActorUrl))
    if (existing.length) throw createError({ statusCode: 400, message: '이미 팔로우 중인 계정입니다' })

    const actorData = await fetchActor(targetActorUrl)
    if (!actorData) throw createError({ statusCode: 404, message: '계정 정보를 가져올 수 없습니다' })

    const inboxUrl = (actorData.endpoints as Record<string, string> | undefined)?.sharedInbox
        || actorData.inbox as string
    if (!inboxUrl) throw createError({ statusCode: 400, message: '이 계정은 inbox가 없습니다' })

    const [, targetDomain] = cleanHandle.split('@')
    const preferredUsername = actorData.preferredUsername as string || ''
    const targetHandle = preferredUsername ? `@${preferredUsername}@${targetDomain}` : `@${cleanHandle}`

    const timelineActor = await ensureTimelineActor()
    if (!timelineActor) throw createError({ statusCode: 500, message: '타임라인 액터 생성 실패' })

    const actorId = timelineActorUrl(domain)
    const follow = buildFollowActivity(actorId, targetActorUrl)

    const [row] = await db.insert(timelineFollows).values({
        targetActorUrl,
        targetInbox: inboxUrl,
        targetHandle,
        targetName: (actorData.name as string) || preferredUsername,
        targetIconUrl: (actorData.icon as Record<string, string> | undefined)?.url || '',
        accepted: false,
        followActivityId: follow.id,
    }).returning()

    const delivered = await deliverToInbox(inboxUrl, follow, actorId, timelineActor.privateKey)
    if (!delivered) {
        console.warn(`[followTimelineAccount] Follow 전송 실패: ${targetActorUrl}`)
    }

    return row
})
