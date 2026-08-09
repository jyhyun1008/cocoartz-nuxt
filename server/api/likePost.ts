import { db } from '../utils/db'
import { likes, posts, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { ensureActor } from '../utils/ap/ensureActor'
import { buildLikeActivity, actorUrl } from '../utils/ap/activitypub'
import { deliverToInbox } from '../utils/ap/deliver'
import { requireUserId } from '../utils/session'

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

    await db.insert(likes).values({ postid, userid })

    // 좋아요 대상이 원격(fediverse)에서 온 답글이면 원 작성자에게 Like를 보낸다
    const [post] = await db.select().from(posts).where(eq(posts.id, postid))
    if (post?.remoteActorUrl && post.remoteActorInbox && post.objectId) {
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
