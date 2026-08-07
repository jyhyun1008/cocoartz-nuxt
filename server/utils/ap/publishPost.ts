import { db } from '../db'
import { users, follows, posts, rooms, customEmojis } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from './ensureActor'
import { actorUrl, postObjectUrl, buildCreateActivity } from './activitypub'
import { deliverToFollowers, deliverToInbox } from './deliver'
import { extractMarkdownImages } from './attachments'
import { buildOutgoingEmojiTags } from './sanitize'
import { marked } from 'marked'

type Post = typeof posts.$inferSelect

// 게시글/댓글이 연합 게시판 글타래에 속해 있으면 AP Note로 배포한다.
// - top-level 글: roomid가 federated 게시판일 때만 대상
// - 답글: 부모 글이 이미 objectId를 가진 경우(=부모도 연합 글타래)만 대상
export async function publishPostIfFederated(post: Post, domain: string) {
    if (!post.userid || !domain) return

    let parent: Post | undefined
    let eligible = false

    if (post.replyto) {
        const [p] = await db.select().from(posts).where(eq(posts.id, Number(post.replyto)))
        parent = p
        eligible = !!parent?.objectId
    } else {
        const [room] = await db.select().from(rooms).where(eq(rooms.id, post.roomid))
        eligible = !!room?.federated
    }
    if (!eligible) return

    const [author] = await db.select().from(users).where(eq(users.id, post.userid))
    if (!author) return

    const actor = await ensureActor(post.userid)
    if (!actor) return

    const objectId = postObjectUrl(domain, author.username, post.id)
    await db.update(posts).set({ objectId }).where(eq(posts.id, post.id))

    // 본문의 마크다운 이미지(![]())는 본문에서 떼어내고 AP attachment로 따로 보냄
    const { text, attachments } = extractMarkdownImages(post.content)

    // 본문에 등장하는 우리 서버 커스텀 이모지(:shortcode:)를 AP tag로 실어 보냄 —
    // 다른 서버에서도 이미지로 보이게 하기 위함(content의 :shortcode: 텍스트 자체는 그대로 둠)
    const allEmojis = await db.select().from(customEmojis)
    const tag = buildOutgoingEmojiTags(domain, text, allEmojis)

    const activity = buildCreateActivity(domain, author.username, {
        objectId,
        content: String(marked.parse(text)),
        published: post.createdAt,
        inReplyTo: parent?.objectId ?? null,
        // 최상위 글에 직접 붙인 제목만 CW로 취급 — 댓글의 title은 content에서 자동으로 잘라낸 것이라 진짜 제목이 아님
        summary: post.replyto ? null : post.title,
        attachment: attachments,
        tag,
    })

    const followerRows = await db.select().from(follows)
        .where(and(eq(follows.userid, post.userid), eq(follows.accepted, true)))

    const actorId = actorUrl(domain, author.username)

    void deliverToFollowers(followerRows, activity, actorId, actor.privateKey)
        .catch((e) => console.error('[publishPost] 팔로워 배포 실패', e))

    if (parent?.remoteActorInbox) {
        void deliverToInbox(parent.remoteActorInbox, activity, actorId, actor.privateKey)
            .catch((e) => console.error('[publishPost] 원격 부모에게 답글 배포 실패', e))
    }
}
