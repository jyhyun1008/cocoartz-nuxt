import { db } from '../utils/db'
import { users, remoteTimelinePosts, remoteTimelinePostLikes } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, buildLikeActivity, buildUndoActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'

// 연합 타임라인(공용) 글에 좋아요 — 마스토돈의 "즐겨찾기"에 해당하는 Like 액티비티를 원 작성자에게 보냄.
// 글 자체가 이제 유저 전용이 아니라 서버 공용이라, 좋아요 여부는 remoteTimelinePostLikes에 뷰어별로 따로 기록하고
// 배송할 inbox는 (뷰어가 그 계정을 개인적으로 팔로우하지 않아도 되도록) 글에 캐시된 sourceInbox를 그대로 씀
export default eventHandler(async (event) => {
    const { id, userid } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const [post] = await db.select().from(remoteTimelinePosts).where(eq(remoteTimelinePosts.id, id))
    if (!post) throw createError({ statusCode: 404, message: '글을 찾을 수 없습니다' })

    const [existingLike] = await db.select().from(remoteTimelinePostLikes)
        .where(and(eq(remoteTimelinePostLikes.remoteTimelinePostId, id), eq(remoteTimelinePostLikes.userid, userid)))

    const [user] = await db.select().from(users).where(eq(users.id, userid))
    const actor = await ensureActor(userid)

    const nextLiked = !existingLike
    const config = useRuntimeConfig()
    const domain = config.domain as string

    if (user && actor) {
        const myActorId = actorUrl(domain, user.username)

        if (nextLiked) {
            const like = buildLikeActivity(domain, user.username, post.objectId)
            void deliverToInbox(post.sourceInbox, like, myActorId, actor.privateKey)
                .catch((e) => console.error('[likeRemoteFeedPost] 좋아요 전송 실패', e))
            await db.insert(remoteTimelinePostLikes).values({
                remoteTimelinePostId: id,
                userid,
                likeActivityId: like.id,
            }).onConflictDoNothing({ target: [remoteTimelinePostLikes.remoteTimelinePostId, remoteTimelinePostLikes.userid] })
        } else {
            const like = buildLikeActivity(domain, user.username, post.objectId)
            like.id = existingLike.likeActivityId ?? like.id
            const undo = buildUndoActivity(myActorId, like)
            void deliverToInbox(post.sourceInbox, undo, myActorId, actor.privateKey)
                .catch((e) => console.error('[likeRemoteFeedPost] 좋아요 취소 전송 실패', e))
            await db.delete(remoteTimelinePostLikes)
                .where(and(eq(remoteTimelinePostLikes.remoteTimelinePostId, id), eq(remoteTimelinePostLikes.userid, userid)))
        }
    }

    return { liked: nextLiked }
})
