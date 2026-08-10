import { db } from '../utils/db'
import { likes, posts, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { buildLikeActivity, actorUrl } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'
import { requireUserId } from '../utils/session'
import { isEmailVerificationRequired, isVerified } from '../utils/emailVerification'

export default eventHandler(async (event) => {
    const { postid } = await readBody(event)
    const userid = await requireUserId(event)
    const existing = await db.select().from(likes).where(
        and(eq(likes.postid, postid), eq(likes.userid, userid))
    )

    if (existing.length > 0) {
        await db.delete(likes).where(and(eq(likes.postid, postid), eq(likes.userid, userid)))
        return { liked: false }
    }

    // 좋아요 대상이 원격(fediverse)에서 온 답글이면 이 좋아요 자체가 그 계정 서버로 실제 배포됨 —
    // createPost.ts 등과 동일하게 이메일 인증한 유저만 가능하게 함(로컬 글 좋아요는 아무 데도 안
    // 나가니 해당 없음). 연합 게시판/개인 타임라인 어느 쪽에서 캐시된 원격 답글이든 동일하게 적용.
    // insert 전에 미리 확인해야 "차단됐는데 좋아요는 이미 눌린" 상태가 안 생김
    const [post] = await db.select().from(posts).where(eq(posts.id, postid))
    const isRemoteTarget = !!(post?.remoteActorUrl && post.remoteActorInbox && post.objectId)
    if (isRemoteTarget) {
        const verificationRequired = await isEmailVerificationRequired()
        if (verificationRequired) {
            const [author] = await db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userid))
            if (!author || !isVerified(author, verificationRequired)) {
                throw createError({ statusCode: 403, message: '이메일 인증을 완료해야 좋아요를 누를 수 있어요' })
            }
        }
    }

    await db.insert(likes).values({ postid, userid })

    // 좋아요 대상이 원격(fediverse)에서 온 답글이면 원 작성자에게 Like를 보낸다
    if (isRemoteTarget) {
        const config = useRuntimeConfig()
        const domain = config.domain as string
        const actor = await ensureActor(userid).catch(() => null)
        const [author] = await db.select().from(users).where(eq(users.id, userid))
        if (actor && author && domain) {
            const activity = buildLikeActivity(domain, author.username, post.objectId)
            void deliverToInbox(post.remoteActorInbox, activity, actorUrl(domain, author.username), actor.privateKey)
                .catch((e) => console.error('[likePost] 원격 좋아요 배포 실패', e))
        }
    }

    return { liked: true }
})
