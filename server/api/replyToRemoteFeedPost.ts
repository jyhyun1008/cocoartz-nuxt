import { db } from '../utils/db'
import { users, posts, remoteTimelinePosts } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, postObjectUrl, buildCreateActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'
import { extractMarkdownImages } from '../utils/ap/attachments'
import { marked } from 'marked'
import { requireUserId } from '../utils/session'

// 연합 타임라인(공용) 글에 댓글을 달면, 로컬에는 글타래 없이 posts에만 저장해두고(목록/타임라인에는
// 안 보임 — remoteParentObjectId 필터로 제외됨) 원 작성자에게는 실제 답글(Create+inReplyTo)로 배포한다.
// 글이 서버 공용이라 뷰어가 그 계정을 개인적으로 팔로우하지 않아도 되고, 글에 캐시된 sourceInbox로 바로 배송함
export default eventHandler(async (event) => {
    const { remoteFeedPostId, serverid, roomid, content } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const trimmed = String(content || '').trim()
    if (!trimmed) throw createError({ statusCode: 400, message: '내용을 입력해주세요' })

    const [feedPost] = await db.select().from(remoteTimelinePosts).where(eq(remoteTimelinePosts.id, remoteFeedPostId))
    if (!feedPost) throw createError({ statusCode: 404, message: '글을 찾을 수 없습니다' })

    const [user] = await db.select().from(users).where(eq(users.id, userid))
    const actor = await ensureActor(userid)
    if (!user || !actor) throw createError({ statusCode: 500, message: '답글을 보낼 수 없습니다' })

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
    const delivered = await deliverToInbox(feedPost.sourceInbox, activity, myActorId, actor.privateKey)
        .catch(() => false)

    return { ...post, objectId, user, delivered }
})
