import { db } from '../utils/db'
import { users, remoteFeedPosts, remoteFollows } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, buildLikeActivity, buildUndoActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'

// 원격(팔로우 피드) 글에 좋아요 — 마스토돈의 "즐겨찾기"에 해당하는 Like 액티비티를 원 작성자에게 보냄
export default eventHandler(async (event) => {
    const { id, userid } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const [feedPost] = await db.select().from(remoteFeedPosts).where(eq(remoteFeedPosts.id, id))
    if (!feedPost || feedPost.userid !== userid) {
        throw createError({ statusCode: 404, message: '글을 찾을 수 없습니다' })
    }

    const [follow] = await db.select().from(remoteFollows)
        .where(and(eq(remoteFollows.userid, userid), eq(remoteFollows.targetActorUrl, feedPost.sourceActorUrl)))
    const [user] = await db.select().from(users).where(eq(users.id, userid))
    const actor = await ensureActor(userid)

    const nextLiked = !feedPost.liked
    await db.update(remoteFeedPosts).set({
        liked: nextLiked,
        likeActivityId: nextLiked ? null : feedPost.likeActivityId, // 아래서 liked면 새로 채움
    }).where(eq(remoteFeedPosts.id, id))

    if (follow && user && actor) {
        const config = useRuntimeConfig()
        const domain = config.domain as string
        const myActorId = actorUrl(domain, user.username)

        if (nextLiked) {
            const like = buildLikeActivity(domain, user.username, feedPost.objectId)
            void deliverToInbox(follow.targetInbox, like, myActorId, actor.privateKey)
                .catch((e) => console.error('[likeRemoteFeedPost] 좋아요 전송 실패', e))
            await db.update(remoteFeedPosts).set({ likeActivityId: like.id }).where(eq(remoteFeedPosts.id, id))
        } else {
            const like = buildLikeActivity(domain, user.username, feedPost.objectId)
            like.id = feedPost.likeActivityId ?? like.id
            const undo = buildUndoActivity(myActorId, like)
            void deliverToInbox(follow.targetInbox, undo, myActorId, actor.privateKey)
                .catch((e) => console.error('[likeRemoteFeedPost] 좋아요 취소 전송 실패', e))
        }
    }

    return { liked: nextLiked }
})
