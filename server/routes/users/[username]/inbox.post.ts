import { db } from '../../../utils/db'
import { users, actors, follows, posts, likes, boosts, rooms, remoteFollows, remoteFeedPosts, remoteTimelinePosts, remoteTimelinePostLikes } from '../../../db/schema'
import { eq, and, count, inArray, desc, type SQL } from 'drizzle-orm'
import { buildAcceptActivity, fetchActor, fetchObject, parseLocalPostId, actorUrl, isPublicAudience, buildActorDisplayInfo } from '../../../utils/ap/activitypub'
import { deliverToInbox } from '../../../utils/ap/deliver'
import { verifyInboxSignature, extractSignatureDomain } from '../../../utils/ap/httpSignature'
import { sanitizeHtml, extractImageAttachmentsHtml, renderCustomEmoji, renderActorName } from '../../../utils/ap/sanitize'
import { checkRateLimit } from '../../../utils/ap/rateLimit'
import { refreshRemoteActorCache } from '../../../utils/remoteActorCache'
import { extractQuoteUrl, extractFirstLink } from '../../../utils/ap/linkExtract'
import { broadcastFederatedBoardPost } from '../../_ws'

const MAX_FOLLOWERS_PER_USER = 5000
const MAX_FOLLOWS_PER_DOMAIN_PER_HOUR = 30
const MAX_INBOX_REQUESTS_PER_MINUTE = 60

type LocalUser = { id: number; username: string; requireFollowApproval: boolean }
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
        case 'Accept':
            await handleAccept(body, user)
            break
        case 'Reject':
            await handleReject(body, user)
            break
        case 'Create':
            await handleCreate(body, domain, user)
            break
        case 'Like':
            await handleLike(body, domain)
            break
        case 'Announce':
            await handleAnnounce(body, domain, user)
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

    const { name: remoteActorName, handle: remoteActorHandle, iconUrl: remoteActorIconUrl } = buildActorDisplayInfo(actorData, followerActorUrl)

    // 수동 승인을 켜둔 유저면 대기 상태로만 쌓아두고, 정작 Accept는 본인이 승인할 때 보냄
    // (상대 서버/클라이언트는 Accept를 받기 전까진 "요청됨" 상태로 표시함)
    const accepted = !user.requireFollowApproval

    await db.insert(follows).values({
        userid: user.id,
        followerActorUrl,
        followerInbox: inboxUrl,
        accepted,
        followActivityId: body.id as string,
        remoteActorName,
        remoteActorHandle,
        remoteActorIconUrl,
        remoteActorCachedAt: new Date(),
    }).onConflictDoUpdate({
        target: [follows.userid, follows.followerActorUrl],
        // accepted는 여기서 안 건드림 — 이미 대기 중인데 같은 Follow가 재전송돼도 자동 승인되면 안 됨
        set: { followerInbox: inboxUrl, remoteActorName, remoteActorHandle, remoteActorIconUrl, remoteActorCachedAt: new Date() },
    })

    if (!accepted) {
        console.log(`[inbox] Follow 대기: ${followerActorUrl} → @${user.username}`)
        return
    }

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

async function handleAccept(body: Record<string, unknown>, user: LocalUser) {
    const object = body.object as Record<string, unknown> | string | undefined
    if (!object || typeof object !== 'object' || object.type !== 'Follow') return
    const followActivityId = object.id as string | undefined
    const actorUrl_ = body.actor as string
    if (!followActivityId && !actorUrl_) return

    await db.update(remoteFollows)
        .set({ accepted: true })
        .where(and(
            eq(remoteFollows.userid, user.id),
            followActivityId ? eq(remoteFollows.followActivityId, followActivityId) : eq(remoteFollows.targetActorUrl, actorUrl_),
        ))
}

async function handleReject(body: Record<string, unknown>, user: LocalUser) {
    const object = body.object as Record<string, unknown> | string | undefined
    if (!object || typeof object !== 'object' || object.type !== 'Follow') return
    const followActivityId = object.id as string | undefined
    if (!followActivityId) return
    await db.delete(remoteFollows).where(and(
        eq(remoteFollows.userid, user.id),
        eq(remoteFollows.followActivityId, followActivityId),
    ))
}

// 이 유저가 팔로우 중인 원격 계정이 새 글(원본 글, 답글 아님)을 올렸을 때 개인 팔로잉 피드에 저장
// 개인 타임라인(getFollowingFeed)에는 공개 범위와 무관하게 다 보여줌 — 팔로우 중인 계정 글은
// 홈 공개/팔로워 공개여도 (팔로우 관계 덕분에 애초에 inbox로 배달된 것이므로) 그대로 노출.
// 다만 이 데이터는 연합 게시판(getRemoteFeedPosts)에도 같이 섞여 나가므로, 거기서 걸러낼 수
// 있도록 공개 범위 판정 결과를 isPublic으로 저장은 해둠(여기서 저장을 막지는 않음).
async function handleCreateFromFollowedAccount(object: Record<string, unknown>, actorUrl_: string, user: LocalUser, activity: Record<string, unknown>) {
    const objectId = typeof object.id === 'string' ? object.id : null
    if (!objectId) return

    const [follow] = await db.select().from(remoteFollows)
        .where(and(eq(remoteFollows.userid, user.id), eq(remoteFollows.targetActorUrl, actorUrl_)))
    if (!follow?.accepted) return

    const [existing] = await db.select().from(remoteFeedPosts)
        .where(and(eq(remoteFeedPosts.userid, user.id), eq(remoteFeedPosts.objectId, objectId)))
    if (existing) return

    const content = renderCustomEmoji(sanitizeHtml(object.content as string || ''), object.tag) + extractImageAttachmentsHtml(object.attachment)
    if (!content) return
    const summary = typeof object.summary === 'string' ? renderCustomEmoji(sanitizeHtml(object.summary), object.tag).trim() || null : null
    const isPublic = isPublicAudience(object, activity)
    const published = new Date((object.published as string) || Date.now())
    const quoteUrl = extractQuoteUrl(object)
    const linkUrl = extractFirstLink(content, quoteUrl)

    await db.insert(remoteFeedPosts).values({
        userid: user.id,
        sourceActorUrl: actorUrl_,
        sourceHandle: follow.targetHandle,
        sourceName: follow.targetName,
        sourceIconUrl: follow.targetIconUrl,
        objectId,
        content,
        summary,
        quoteUrl,
        linkUrl,
        isPublic,
        published,
    })
    console.log(`[inbox] 원격 글 개인 피드 저장: ${objectId} → @${user.username}`)

    // 공개 글이면 유저 구분 없는 서버 공용 연합 타임라인에도 반영(연합 게시판용) — 다른 로컬 유저가
    // 같은 계정을 팔로우해서 동시에 들어와도 objectId unique라 중복 없이 한 번만 저장됨
    if (isPublic) {
        const [inserted] = await db.insert(remoteTimelinePosts).values({
            sourceActorUrl: actorUrl_,
            sourceInbox: follow.targetInbox,
            sourceHandle: follow.targetHandle,
            sourceName: follow.targetName,
            sourceIconUrl: follow.targetIconUrl,
            objectId,
            content,
            summary,
            quoteUrl,
            linkUrl,
            published,
        }).onConflictDoNothing({ target: remoteTimelinePosts.objectId }).returning()

        // 이미 알고 있던 글(다른 유저가 같은 계정을 팔로우해서 중복 유입)이면 onConflictDoNothing이
        // 아무것도 안 돌려줌 — 그럴 땐 이미 한 번 스트리밍했을 테니 다시 안 보냄. 진짜 새로 저장된
        // 경우에만 연합 게시판을 지금 보고 있는 사람들에게 실시간으로 흘려보냄(연합 타임라인 스트리밍)
        if (inserted) {
            const [federatedRoom] = await db.select({ path: rooms.path }).from(rooms).where(eq(rooms.federated, true)).orderBy(desc(rooms.id)).limit(1)
            if (federatedRoom) {
                void broadcastFederatedBoardPost(federatedRoom.path, { kind: 'remote', post: { ...inserted, liked: false } })
                    .catch((e) => console.error('[inbox] 연합 게시판 스트리밍 실패', e))
            }
        }
    }
}

// 인바운드 답글(Create+inReplyTo) 하나를 posts에 캐시해두는 공통 로직 — 로컬 글에 대한 답글이든,
// 우리가 알고 있는 원격 글(연합 게시판/개인 팔로잉 피드 원본, 혹은 그에 대해 이미 캐시해둔 답글)에
// 대한 답글이든 저장 방식은 동일하고 어느 쪽에 매달지(replyto vs remoteParentObjectId)만 다름
async function saveIncomingReplyPost(
    object: Record<string, unknown>,
    actorUrl_: string,
    objectId: string,
    opts: { replyto?: string; remoteParentObjectId?: string; serverid?: number | null; roomid?: number | null },
) {
    const actorData = await fetchActor(actorUrl_)
    const preferredUsername = actorData?.preferredUsername as string || ''
    const actorDomain = new URL(actorUrl_).hostname
    const content = renderCustomEmoji(sanitizeHtml(object.content as string || ''), object.tag)
    const contentWithImages = content + extractImageAttachmentsHtml(object.attachment)
    const quoteUrl = extractQuoteUrl(object)
    const linkUrl = extractFirstLink(contentWithImages, quoteUrl)
    // handleCreateFromFollowedAccount와 동일한 CW 추출 — 여기선 빠져있어서 원격 답글(댓글)의
    // CW가 화면에 전혀 안 뜨던 문제가 있었음
    const summary = typeof object.summary === 'string' ? renderCustomEmoji(sanitizeHtml(object.summary), object.tag).trim() || null : null

    await db.insert(posts).values({
        serverid: opts.serverid ?? null,
        roomid: opts.roomid ?? null,
        userid: null,
        title: content.slice(0, 50) || '(원격 답글)',
        content: contentWithImages,
        summary,
        quoteUrl,
        linkUrl,
        replyto: opts.replyto ?? null,
        remoteParentObjectId: opts.remoteParentObjectId ?? null,
        objectId,
        remoteActorUrl: actorUrl_,
        remoteActorName: renderActorName((actorData?.name as string) || preferredUsername, actorData?.tag),
        remoteActorHandle: preferredUsername ? `@${preferredUsername}@${actorDomain}` : '',
        remoteActorIconUrl: (actorData?.icon as Record<string, string> | undefined)?.url || '',
        remoteActorInbox: (actorData?.endpoints as Record<string, string> | undefined)?.sharedInbox
            || actorData?.inbox as string || '',
        createdAt: new Date((object.published as string) || Date.now()),
    })
}

async function handleCreate(body: Record<string, unknown>, domain: string, user: LocalUser) {
    const object = body.object as Record<string, unknown>
    if (!object || object.type !== 'Note') return

    const objectId = typeof object.id === 'string' ? object.id : null
    const inReplyTo = object.inReplyTo as string | undefined
    const actorUrl_ = body.actor as string
    if (!objectId || !actorUrl_) return

    // inReplyTo가 없으면 로컬 글에 대한 답글이 아니라 팔로우 중인 원격 계정의 원본 글
    if (!inReplyTo) {
        await handleCreateFromFollowedAccount(object, actorUrl_, user, body)
        return
    }

    const [existing] = await db.select().from(posts).where(eq(posts.objectId, objectId))
    if (existing) return

    // 답글은 공개 범위와 무관하게 전부 받음 — 부모 글이 이미 공개인 이상 답글 자체의 공개 범위는
    // 그 대화에 참여했다는 맥락일 뿐이라 걸러낼 이유가 없고, 로컬↔원격 양방향 답글 스레드가
    // 목표라 여기서 막으면 대화가 끊김. (공개 범위 필터링은 handleCreateFromFollowedAccount의
    // 원본 글 쪽에만 적용됨)
    const parentId = parseLocalPostId(domain, inReplyTo)
    if (parentId) {
        const [parent] = await db.select().from(posts).where(eq(posts.id, parentId))
        if (!parent) return
        // roomid가 있는(=일반 게시판 글타래) 부모면 그 방이 연합 게시판인지 확인. roomid가 없는
        // 부모(개인 타임라인/연합 게시판에서 원격 글에 단 답글 스텁)는 애초에 연합 답글을 주고받으려고
        // 만든 것이므로 방 검사 없이 그대로 허용
        if (parent.roomid !== null) {
            const [room] = await db.select().from(rooms).where(eq(rooms.id, parent.roomid))
            if (!room?.federated) return
        }
        await saveIncomingReplyPost(object, actorUrl_, objectId, {
            replyto: String(parentId),
            serverid: parent.serverid,
            roomid: parent.roomid,
        })
        console.log(`[inbox] 원격 답글 저장: ${objectId} → post#${parentId}`)
        return
    }

    // 로컬 글에 대한 답글이 아니면, 우리가 이미 아는 원격 글(연합 게시판/개인 팔로잉 피드의 원본,
    // 혹은 그에 대해 이미 캐시해둔 답글)에 달린 답글인지 확인해서 맞으면 댓글로 캐시해둔다.
    // getRemoteFeedPostReplies가 objectId 기준으로 조회하므로 연합 게시판/개인 타임라인 어느 쪽
    // 상세보기에서든 그대로 노출됨 — 이게 이번에 추가된 "연합으로 들어온 답글도 댓글로 캐시" 기능.
    const [knownTimelinePost] = await db.select({ id: remoteTimelinePosts.id }).from(remoteTimelinePosts)
        .where(eq(remoteTimelinePosts.objectId, inReplyTo))
    const [knownFeedPost] = knownTimelinePost ? [] : await db.select({ id: remoteFeedPosts.id }).from(remoteFeedPosts)
        .where(eq(remoteFeedPosts.objectId, inReplyTo))
    const [knownCachedReply] = (knownTimelinePost || knownFeedPost) ? [] : await db.select({ id: posts.id }).from(posts)
        .where(eq(posts.objectId, inReplyTo))

    if (!knownTimelinePost && !knownFeedPost && !knownCachedReply) return

    await saveIncomingReplyPost(object, actorUrl_, objectId, { remoteParentObjectId: inReplyTo })
    console.log(`[inbox] 원격 글에 달린 원격 답글 캐시: ${objectId} → ${inReplyTo}`)
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
        remoteActorName: renderActorName((actorData?.name as string) || preferredUsername, actorData?.tag),
        remoteActorHandle: preferredUsername ? `@${preferredUsername}@${actorDomain}` : '',
        remoteActorIconUrl: (actorData?.icon as Record<string, string> | undefined)?.url || '',
        activityId: activityId ?? null,
    })
    console.log(`[inbox] 원격 좋아요: ${actorUrl_} → post#${postId}`)
}

async function handleAnnounce(body: Record<string, unknown>, domain: string, user: LocalUser) {
    const objectId = typeof body.object === 'string' ? body.object : (body.object as Record<string, unknown>)?.id as string
    const actorUrl_ = body.actor as string
    const activityId = body.id as string | undefined
    if (!objectId || !actorUrl_ || !activityId) return

    const postId = parseLocalPostId(domain, objectId)
    if (!postId) {
        // 우리 글이 아니라 순수 원격↔원격 부스트 — 내가 팔로우 중인 계정이 다른 원격 글을 재게시한
        // 경우로, 개인 피드/연합 타임라인에 "OO님이 재게시했습니다"로 보여주기 위한 처리로 넘김
        await handleAnnounceFromFollowedAccount(objectId, actorUrl_, user)
        return
    }
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
        actorName: renderActorName((actorData?.name as string) || preferredUsername, actorData?.tag),
        actorHandle: preferredUsername ? `@${preferredUsername}@${actorDomain}` : '',
        actorIconUrl: (actorData?.icon as Record<string, string> | undefined)?.url || '',
        activityId,
    })
    console.log(`[inbox] 원격 부스트: ${actorUrl_} → post#${postId}`)
}

// 내가 팔로우 중인 원격 계정이 (우리 글이 아닌) 다른 원격 글을 부스트한 경우 — 원본 글 자체를
// 가져와서 handleCreateFromFollowedAccount와 동일한 방식으로 개인 피드/연합 타임라인에 저장하되,
// "누가 부스트했는지"는 boostedBy* 필드에 별도로 남겨서 화면에 "OO님이 재게시했습니다"로 표시함
async function handleAnnounceFromFollowedAccount(objectId: string, actorUrl_: string, user: LocalUser) {
    const [follow] = await db.select().from(remoteFollows)
        .where(and(eq(remoteFollows.userid, user.id), eq(remoteFollows.targetActorUrl, actorUrl_)))
    if (!follow?.accepted) return

    const [existing] = await db.select().from(remoteFeedPosts)
        .where(and(eq(remoteFeedPosts.userid, user.id), eq(remoteFeedPosts.objectId, objectId)))
    if (existing) return

    const object = await fetchObject(objectId)
    if (!object || object.type !== 'Note') return

    const attributedTo = typeof object.attributedTo === 'string' ? object.attributedTo : null
    if (!attributedTo) return
    const authorData = await fetchActor(attributedTo)
    if (!authorData) return
    const authorPreferredUsername = authorData.preferredUsername as string || ''
    const authorDomain = new URL(attributedTo).hostname
    const authorHandle = authorPreferredUsername ? `@${authorPreferredUsername}@${authorDomain}` : ''
    const authorName = renderActorName((authorData.name as string) || authorPreferredUsername, authorData.tag)
    const authorIconUrl = (authorData.icon as Record<string, string> | undefined)?.url || ''
    const authorInbox = authorData.inbox as string || ''
    if (!authorInbox) return

    const content = renderCustomEmoji(sanitizeHtml(object.content as string || ''), object.tag) + extractImageAttachmentsHtml(object.attachment)
    if (!content) return
    const summary = typeof object.summary === 'string' ? renderCustomEmoji(sanitizeHtml(object.summary), object.tag).trim() || null : null
    const isPublic = isPublicAudience(object)
    const published = new Date((object.published as string) || Date.now())
    const quoteUrl = extractQuoteUrl(object)
    const linkUrl = extractFirstLink(content, quoteUrl)

    await db.insert(remoteFeedPosts).values({
        userid: user.id,
        sourceActorUrl: attributedTo,
        sourceHandle: authorHandle,
        sourceName: authorName,
        sourceIconUrl: authorIconUrl,
        boostedByActorUrl: actorUrl_,
        boostedByName: follow.targetName,
        boostedByHandle: follow.targetHandle,
        boostedByIconUrl: follow.targetIconUrl,
        objectId,
        content,
        summary,
        quoteUrl,
        linkUrl,
        isPublic,
        published,
    })
    console.log(`[inbox] 원격 부스트 개인 피드 저장: ${follow.targetHandle} → ${objectId}`)

    if (isPublic) {
        const [inserted] = await db.insert(remoteTimelinePosts).values({
            sourceActorUrl: attributedTo,
            sourceInbox: authorInbox,
            sourceHandle: authorHandle,
            sourceName: authorName,
            sourceIconUrl: authorIconUrl,
            boostedByActorUrl: actorUrl_,
            boostedByName: follow.targetName,
            boostedByHandle: follow.targetHandle,
            boostedByIconUrl: follow.targetIconUrl,
            objectId,
            content,
            summary,
            quoteUrl,
            linkUrl,
            published,
        }).onConflictDoNothing({ target: remoteTimelinePosts.objectId }).returning()

        // 재게시(boostedByActorUrl 있음)는 getFederatedBoardFeed.ts와 동일하게 "재게시를 받은
        // 시각"을 표시용 published로 맞춰서 보냄(원 글 작성 시각 그대로면 목록 맨 위에 새로
        // 꽂아 넣었는데 날짜만 옛날로 보이는 어색함이 생김)
        if (inserted) {
            const [federatedRoom] = await db.select({ path: rooms.path }).from(rooms).where(eq(rooms.federated, true)).orderBy(desc(rooms.id)).limit(1)
            if (federatedRoom) {
                void broadcastFederatedBoardPost(federatedRoom.path, {
                    kind: 'remote',
                    post: { ...inserted, published: inserted.createdAt, liked: false },
                }).catch((e) => console.error('[inbox] 연합 게시판 스트리밍 실패', e))
            }
        }
    }
}

// remoteTimelinePosts는 FK 제약이 없는 스키마 스타일이라, 삭제 전에 딸린 좋아요(remoteTimelinePostLikes)부터 정리해야 함
async function deleteRemoteTimelinePosts(condition: SQL) {
    const rows = await db.select({ id: remoteTimelinePosts.id }).from(remoteTimelinePosts).where(condition)
    if (!rows.length) return
    const ids = rows.map((r) => r.id)
    await db.delete(remoteTimelinePostLikes).where(inArray(remoteTimelinePostLikes.remoteTimelinePostId, ids))
    await db.delete(remoteTimelinePosts).where(condition)
}

async function handleDelete(body: Record<string, unknown>) {
    const actorUrl_ = body.actor as string | undefined
    if (!actorUrl_) return

    // object가 문자열(objectId) 또는 Tombstone일 수 있음. 없거나 액터 자기 자신을
    // 가리키면 "계정 자체" 삭제, 그 외엔 글 하나만 삭제된 것으로 구분해야 함
    // (기존엔 이 구분이 없어서 답글 하나만 지워도 그 액터의 팔로우/좋아요/부스트/글이
    // 전부 삭제되는 오류가 있었고, remoteFeedPosts는 아예 정리 대상에서 빠져있었음)
    const object = body.object as Record<string, unknown> | string | undefined
    const deletedObjectId = typeof object === 'string' ? object : (object?.id as string | undefined)

    if (!deletedObjectId || deletedObjectId === actorUrl_) {
        await db.delete(follows).where(eq(follows.followerActorUrl, actorUrl_))
        await db.delete(likes).where(eq(likes.remoteActorUrl, actorUrl_))
        await db.delete(boosts).where(eq(boosts.actorUrl, actorUrl_))
        await db.delete(posts).where(eq(posts.remoteActorUrl, actorUrl_))
        await db.delete(remoteFeedPosts).where(eq(remoteFeedPosts.sourceActorUrl, actorUrl_))
        await deleteRemoteTimelinePosts(eq(remoteTimelinePosts.sourceActorUrl, actorUrl_))
        console.log(`[inbox] 원격 계정 정리: ${actorUrl_}`)
        return
    }

    await db.delete(posts).where(eq(posts.objectId, deletedObjectId))
    await db.delete(remoteFeedPosts).where(eq(remoteFeedPosts.objectId, deletedObjectId))
    await deleteRemoteTimelinePosts(eq(remoteTimelinePosts.objectId, deletedObjectId))
    console.log(`[inbox] 원격 글 삭제 반영: ${deletedObjectId}`)
}

async function handleUpdate(body: Record<string, unknown>) {
    const object = body.object as Record<string, unknown>
    if (!object || typeof object !== 'object') return
    const type = object.type as string
    if (!['Person', 'Service', 'Application', 'Group', 'Organization'].includes(type)) return

    const actorUrl_ = (object.id || body.actor) as string
    if (!actorUrl_) return

    await refreshRemoteActorCache(actorUrl_)
}
