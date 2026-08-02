import { db } from '../utils/db'
import { users, posts, remoteFeedPosts, remoteFollows } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, postObjectUrl, buildCreateActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'
import { extractMarkdownImages } from '../utils/ap/attachments'
import { marked } from 'marked'

// 팔로우 피드에 뜬 원격 글에 댓글을 달면, 로컬에는 글타래 없이 posts에만 저장해두고(목록/타임라인에는
// 안 보임 — remoteParentObjectId 필터로 제외됨) 원 작성자에게는 실제 답글(Create+inReplyTo)로 배포한다.
export default eventHandler(async (event) => {
    const { userid, remoteFeedPostId, serverid, roomid, content } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const trimmed = String(content || '').trim()
    if (!trimmed) throw createError({ statusCode: 400, message: '내용을 입력해주세요' })

    const [feedPost] = await db.select().from(remoteFeedPosts).where(eq(remoteFeedPosts.id, remoteFeedPostId))
    if (!feedPost || feedPost.userid !== userid) {
        throw createError({ statusCode: 404, message: '글을 찾을 수 없습니다' })
    }

    const [follow] = await db.select().from(remoteFollows)
        .where(and(eq(remoteFollows.userid, userid), eq(remoteFollows.targetActorUrl, feedPost.sourceActorUrl)))
    const [user] = await db.select().from(users).where(eq(users.id, userid))
    const actor = await ensureActor(userid)
    if (!follow || !user || !actor) throw createError({ statusCode: 500, message: '답글을 보낼 수 없습니다' })

    const config = useRuntimeConfig()
    const domain = config.domain as string

    const [post] = await db.insert(posts).values({
        serverid,
        roomid,
        userid,
        title: trimmed.slice(0, 50),
        content: trimmed,
        remoteParentObjectId: feedPost.objectId,
    }).returning()

    const objectId = postObjectUrl(domain, user.username, post.id)
    await db.update(posts).set({ objectId }).where(eq(posts.id, post.id))

    const { text, attachments } = extractMarkdownImages(trimmed)
    const activity = buildCreateActivity(domain, user.username, {
        objectId,
        content: String(marked.parse(text)),
        published: post.createdAt,
        inReplyTo: feedPost.objectId,
        attachment: attachments,
    })
    const myActorId = actorUrl(domain, user.username)
    const delivered = await deliverToInbox(follow.targetInbox, activity, myActorId, actor.privateKey)
        .catch(() => false)

    return { ...post, objectId, user, delivered }
})
