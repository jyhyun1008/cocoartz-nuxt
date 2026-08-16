import { db } from '../utils/db'
import { posts, users, likes, reactions, boosts, follows } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, buildDeleteActivity } from '../utils/ap/activitypub'
import { deliverToFollowers, deliverToInbox } from '../utils/ap/deliver'
import { requireUserId } from '../utils/session'
import { hasPermission } from '../utils/permissions'

export default eventHandler(async (event) => {
    const { postid } = await readBody(event)
    const userid = await requireUserId(event)
    const [post] = await db.select().from(posts).where(eq(posts.id, postid))
    if (!post) throw createError({ statusCode: 404, message: '게시글을 찾을 수 없습니다' })
    // 본인 글이거나, 관리자가 부여한 deletePosts 권한(모더레이션)이 있으면 삭제 가능
    if (post.userid !== userid && !(await hasPermission(userid, 'deletePosts'))) {
        throw createError({ statusCode: 403, message: '본인 글만 삭제할 수 있습니다' })
    }

    // 연합 게시판에 이미 배포된 글이면(objectId 있음) 원격에도 삭제를 알림 — 실패해도 로컬 삭제는 진행
    if (post.objectId) {
        const config = useRuntimeConfig()
        const domain = config.domain as string
        const [author] = await db.select().from(users).where(eq(users.id, post.userid))
        const actor = author ? await ensureActor(post.userid) : null
        if (author && actor && domain) {
            const activity = buildDeleteActivity(domain, author.username, post.objectId)
            const actorId = actorUrl(domain, author.username)

            const followerRows = await db.select().from(follows)
                .where(eq(follows.userid, post.userid))
            void deliverToFollowers(followerRows, activity, actorId, actor.privateKey)
                .catch((e) => console.error('[deletePost] 팔로워에게 삭제 배포 실패', e))

            if (post.replyto) {
                const [parent] = await db.select().from(posts).where(eq(posts.id, Number(post.replyto)))
                if (parent?.remoteActorInbox) {
                    void deliverToInbox(parent.remoteActorInbox, activity, actorId, actor.privateKey)
                        .catch((e) => console.error('[deletePost] 원격 부모에게 삭제 배포 실패', e))
                }
            }
        }
    }

    const replyRows = await db.select({ id: posts.id }).from(posts).where(eq(posts.replyto, String(postid)))
    const allIds = [postid, ...replyRows.map((r) => r.id)]

    await db.delete(likes).where(inArray(likes.postid, allIds))
    await db.delete(reactions).where(inArray(reactions.postid, allIds))
    await db.delete(boosts).where(inArray(boosts.postid, allIds))
    await db.delete(posts).where(inArray(posts.id, allIds))

    return { success: true }
})
