import { db } from '../db'
import { users, follows, posts, rooms } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from './ensureActor'
import { actorUrl, postObjectUrl, buildCreateActivity } from './activitypub'
import { deliverToFollowers, deliverToInbox } from './deliver'
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

    const activity = buildCreateActivity(domain, author.username, {
        objectId,
        content: String(marked.parse(post.content)),
        published: post.createdAt,
        inReplyTo: parent?.objectId ?? null,
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
