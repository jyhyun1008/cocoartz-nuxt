import { db } from '../../../utils/db'
import { users, actors, follows, posts, likes, boosts, rooms } from '../../../db/schema'
import { eq, and, count } from 'drizzle-orm'
import { buildAcceptActivity, fetchActor, parseLocalPostId, actorUrl } from '../../../utils/ap/activitypub'
import { deliverToInbox } from '../../../utils/ap/deliver'
import { verifyInboxSignature, extractSignatureDomain } from '../../../utils/ap/httpSignature'
import { sanitizeHtml } from '../../../utils/ap/sanitize'
import { checkRateLimit } from '../../../utils/ap/rateLimit'

const MAX_FOLLOWERS_PER_USER = 5000
const MAX_FOLLOWS_PER_DOMAIN_PER_HOUR = 30
const MAX_INBOX_REQUESTS_PER_MINUTE = 60

type LocalUser = { id: number; username: string }
type LocalActor = { privateKey: string }

export default defineEventHandler(async (event) => {
    const username = getRouterParam(event, 'username')!
    const config = useRuntimeConfig()
    const domain = config.domain as string

    const sigHeader = getRequestHeader(event, 'signature')
    const remoteKey =
        extractSignatureDomain(sigHeader)
        ?? getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
        ?? getRequestHeader(event, 'x-real-ip')
        ?? 'unknown'

    if (!checkRateLimit(`inbox:${remoteKey}`, MAX_INBOX_REQUESTS_PER_MINUTE, 60_000)) {
        throw createError({ statusCode: 429, message: '요청이 너무 많습니다' })
    }

    const rawBody = await readRawBody(event) ?? new Uint8Array()
    let body: Record<string, unknown>
    try {
        body = JSON.parse(Buffer.from(rawBody).toString('utf-8'))
    } catch {
        throw createError({ statusCode: 400, message: '잘못된 요청' })
    }
    const activityType = body.type as string

    if (!sigHeader) {
        console.warn(`[inbox] 서명 없는 요청 from: ${body.actor}`)
        throw createError({ statusCode: 401, message: '서명이 필요합니다' })
    }
    const url = getRequestURL(event)
    const sigOk = await verifyInboxSignature(
        sigHeader,
        'POST',
        url.pathname,
        (h) => getRequestHeader(event, h),
        rawBody,
        domain,
    )
    if (!sigOk) {
        console.warn(`[inbox] 서명 검증 실패 from: ${body.actor}`)
        throw createError({ statusCode: 401, message: '서명 검증 실패' })
    }

    const [user] = await db.select().from(users).where(eq(users.username, username))
    if (!user) throw createError({ statusCode: 404, message: '존재하지 않는 유저입니다' })
    const [actor] = await db.select().from(actors).where(eq(actors.userid, user.id))
    if (!actor) throw createError({ statusCode: 404, message: '연합에 참여하지 않은 유저입니다' })

    switch (activityType) {
        case 'Follow':
            await handleFollow(body, user, actor, domain)
            break
        case 'Undo':
            await handleUndo(body, user)
            break
        case 'Create':
            await handleCreate(body, domain)
            break
        case 'Like':
            await handleLike(body, domain)
            break
        case 'Announce':
            await handleAnnounce(body, domain)
            break
        case 'Delete':
            await handleDelete(body)
            break
        case 'Update':
            await handleUpdate(body)
            break
        default:
            break
    }

    return { status: 'ok' }
})

async function handleFollow(body: Record<string, unknown>, user: LocalUser, actor: LocalActor, domain: string) {
    const followerActorUrl = body.actor as string
    if (!followerActorUrl) return

    const followerDomain = new URL(followerActorUrl).hostname
    if (!checkRateLimit(`follow:${followerDomain}`, MAX_FOLLOWS_PER_DOMAIN_PER_HOUR, 3600_000)) {
        console.warn(`[inbox] Follow 레이트 리밋: ${followerDomain}`)
        return
    }

    const [row] = await db.select({ c: count() }).from(follows).where(eq(follows.userid, user.id))
    if ((row?.c ?? 0) >= MAX_FOLLOWERS_PER_USER) {
        console.warn(`[inbox] Follow 상한 초과: @${user.username}`)
        return
    }

    const actorData = await fetchActor(followerActorUrl)
    if (!actorData) return
    const inboxUrl = (actorData.endpoints as Record<string, string> | undefined)?.sharedInbox
        || actorData.inbox as string
    if (!inboxUrl) return

    await db.insert(follows).values({
        userid: user.id,
        followerActorUrl,
        followerInbox: inboxUrl,
        accepted: true,
        followActivityId: body.id as string,
    }).onConflictDoUpdate({
        target: [follows.userid, follows.followerActorUrl],
        set: { accepted: true, followerInbox: inboxUrl },
    })

    const accept = buildAcceptActivity(domain, user.username, body)
    await deliverToInbox(inboxUrl, accept, actorUrl(domain, user.username), actor.privateKey)
    console.log(`[inbox] Follow 수락: ${followerActorUrl} → @${user.username}`)
}

async function handleUndo(body: Record<string, unknown>, user: LocalUser) {
    const object = body.object as Record<string, unknown> | string | undefined
    const objType = object && typeof object === 'object' ? object.type as string : null
    const actorUrl_ = body.actor as string
    if (!actorUrl_) return

    if (objType === 'Follow') {
        await db.delete(follows).where(and(eq(follows.userid, user.id), eq(follows.followerActorUrl, actorUrl_)))
        console.log(`[inbox] Unfollow: ${actorUrl_}`)
        return
    }
    if (objType === 'Like') {
        const activityId = (object as Record<string, unknown>).id as string | undefined
        if (activityId) await db.delete(likes).where(eq(likes.activityId, activityId))
        return
    }
    if (objType === 'Announce') {
        const activityId = (object as Record<string, unknown>).id as string | undefined
        if (activityId) await db.delete(boosts).where(eq(boosts.activityId, activityId))
        return
    }
}

async function handleCreate(body: Record<string, unknown>, domain: string) {
    const object = body.object as Record<string, unknown>
    if (!object || object.type !== 'Note') return

    const objectId = typeof object.id === 'string' ? object.id : null
    const inReplyTo = object.inReplyTo as string | undefined
    const actorUrl_ = body.actor as string
    if (!objectId || !inReplyTo || !actorUrl_) return

    const parentId = parseLocalPostId(domain, inReplyTo)
    if (!parentId) return

    const [parent] = await db.select().from(posts).where(eq(posts.id, parentId))
    if (!parent) return
    const [room] = await db.select().from(rooms).where(eq(rooms.id, parent.roomid))
    if (!room?.federated) return

    const [existing] = await db.select().from(posts).where(eq(posts.objectId, objectId))
    if (existing) return

    const actorData = await fetchActor(actorUrl_)
    const preferredUsername = actorData?.preferredUsername as string || ''
    const actorDomain = new URL(actorUrl_).hostname
    const content = sanitizeHtml(object.content as string || '')

    await db.insert(posts).values({
        serverid: parent.serverid,
        roomid: parent.roomid,
        userid: null,
        title: content.slice(0, 50) || '(원격 답글)',
        content,
        replyto: String(parentId),
        objectId,
        remoteActorUrl: actorUrl_,
        remoteActorName: (actorData?.name as string) || preferredUsername,
        remoteActorHandle: preferredUsername ? `@${preferredUsername}@${actorDomain}` : '',
        remoteActorIconUrl: (actorData?.icon as Record<string, string> | undefined)?.url || '',
        remoteActorInbox: (actorData?.endpoints as Record<string, string> | undefined)?.sharedInbox
            || actorData?.inbox as string || '',
        createdAt: new Date((object.published as string) || Date.now()),
    })
    console.log(`[inbox] 원격 답글 저장: ${objectId} → post#${parentId}`)
}

async function handleLike(body: Record<string, unknown>, domain: string) {
    const objectId = typeof body.object === 'string' ? body.object : (body.object as Record<string, unknown>)?.id as string
    const actorUrl_ = body.actor as string
    const activityId = body.id as string | undefined
    if (!objectId || !actorUrl_) return

    const postId = parseLocalPostId(domain, objectId)
    if (!postId) return
    const [post] = await db.select().from(posts).where(eq(posts.id, postId))
    if (!post) return
    const [room] = await db.select().from(rooms).where(eq(rooms.id, post.roomid))
    if (!room?.federated) return

    if (activityId) {
        const [existing] = await db.select().from(likes).where(eq(likes.activityId, activityId))
        if (existing) return
    }

    const actorData = await fetchActor(actorUrl_)
    const preferredUsername = actorData?.preferredUsername as string || ''
    const actorDomain = new URL(actorUrl_).hostname

    await db.insert(likes).values({
        postid: postId,
        userid: null,
        remoteActorUrl: actorUrl_,
        remoteActorName: (actorData?.name as string) || preferredUsername,
        remoteActorHandle: preferredUsername ? `@${preferredUsername}@${actorDomain}` : '',
        remoteActorIconUrl: (actorData?.icon as Record<string, string> | undefined)?.url || '',
        activityId: activityId ?? null,
    })
    console.log(`[inbox] 원격 좋아요: ${actorUrl_} → post#${postId}`)
}

async function handleAnnounce(body: Record<string, unknown>, domain: string) {
    const objectId = typeof body.object === 'string' ? body.object : (body.object as Record<string, unknown>)?.id as string
    const actorUrl_ = body.actor as string
    const activityId = body.id as string | undefined
    if (!objectId || !actorUrl_ || !activityId) return

    const postId = parseLocalPostId(domain, objectId)
    if (!postId) return
    const [post] = await db.select().from(posts).where(eq(posts.id, postId))
    if (!post) return
    const [room] = await db.select().from(rooms).where(eq(rooms.id, post.roomid))
    if (!room?.federated) return

    const [existing] = await db.select().from(boosts).where(eq(boosts.activityId, activityId))
    if (existing) return

    const actorData = await fetchActor(actorUrl_)
    const preferredUsername = actorData?.preferredUsername as string || ''
    const actorDomain = new URL(actorUrl_).hostname

    await db.insert(boosts).values({
        postid: postId,
        actorUrl: actorUrl_,
        actorName: (actorData?.name as string) || preferredUsername,
        actorHandle: preferredUsername ? `@${preferredUsername}@${actorDomain}` : '',
        actorIconUrl: (actorData?.icon as Record<string, string> | undefined)?.url || '',
        activityId,
    })
    console.log(`[inbox] 원격 부스트: ${actorUrl_} → post#${postId}`)
}

async function handleDelete(body: Record<string, unknown>) {
    const actorUrl_ = body.actor as string | undefined
    if (!actorUrl_) return

    // 원격 계정 삭제로 간주하고 해당 액터의 흔적 정리
    await db.delete(follows).where(eq(follows.followerActorUrl, actorUrl_))
    await db.delete(likes).where(eq(likes.remoteActorUrl, actorUrl_))
    await db.delete(boosts).where(eq(boosts.actorUrl, actorUrl_))
    await db.delete(posts).where(eq(posts.remoteActorUrl, actorUrl_))
    console.log(`[inbox] 원격 계정 정리: ${actorUrl_}`)
}

async function handleUpdate(body: Record<string, unknown>) {
    const object = body.object as Record<string, unknown>
    if (!object || typeof object !== 'object') return
    const type = object.type as string
    if (!['Person', 'Service', 'Application', 'Group', 'Organization'].includes(type)) return

    const actorUrl_ = (object.id || body.actor) as string
    if (!actorUrl_) return

    const actorData = await fetchActor(actorUrl_)
    if (!actorData) return

    const preferredUsername = actorData.preferredUsername as string || ''
    const actorDomain = new URL(actorUrl_).hostname
    const actorName = (actorData.name as string) || preferredUsername
    const actorHandle = preferredUsername ? `@${preferredUsername}@${actorDomain}` : ''
    const actorIconUrl = (actorData.icon as Record<string, string> | undefined)?.url || ''

    await db.update(posts)
        .set({ remoteActorName: actorName, remoteActorHandle: actorHandle, remoteActorIconUrl: actorIconUrl })
        .where(eq(posts.remoteActorUrl, actorUrl_))
    await db.update(likes)
        .set({ remoteActorName: actorName, remoteActorHandle: actorHandle, remoteActorIconUrl: actorIconUrl })
        .where(eq(likes.remoteActorUrl, actorUrl_))
    await db.update(boosts)
        .set({ actorName, actorHandle, actorIconUrl })
        .where(eq(boosts.actorUrl, actorUrl_))
}
