import { db } from '../utils/db'
import { users, remoteFeedPosts, remoteFollows } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { actorUrl, buildLikeActivity, buildUndoActivity } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'
import { requireUserId } from '../utils/session'
import { isEmailVerificationRequired, isVerified } from '../utils/emailVerification'

// 개인 팔로잉 피드(remoteFeedPosts)에 뜬 원격 글에 좋아요 — 마스토돈의 "즐겨찾기"에 해당하는
// Like 액티비티를 원 작성자에게 보냄. (서버 공용 연합 게시판용 likeRemoteFeedPost.ts와는 별개 —
// 그쪽은 remoteTimelinePosts 전용이고 이건 유저별 개인 피드 전용)
export default eventHandler(async (event) => {
    const { id } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    // 좋아요/좋아요 취소 둘 다 원 작성자 서버로 실제 배포됨 — createPost.ts 등과 동일한 이메일 인증 게이트
    const verificationRequired = await isEmailVerificationRequired()
    if (verificationRequired) {
        const [author] = await db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userid))
        if (!author || !isVerified(author, verificationRequired)) {
            throw createError({ statusCode: 403, message: '이메일 인증을 완료해야 좋아요를 누를 수 있어요' })
        }
    }

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
                .catch((e) => console.error('[likeFollowingFeedPost] 좋아요 전송 실패', e))
            await db.update(remoteFeedPosts).set({ likeActivityId: like.id }).where(eq(remoteFeedPosts.id, id))
        } else {
            const like = buildLikeActivity(domain, user.username, feedPost.objectId)
            like.id = feedPost.likeActivityId ?? like.id
            const undo = buildUndoActivity(myActorId, like)
            void deliverToInbox(follow.targetInbox, undo, myActorId, actor.privateKey)
                .catch((e) => console.error('[likeFollowingFeedPost] 좋아요 취소 전송 실패', e))
        }
    }

    return { liked: nextLiked }
})
