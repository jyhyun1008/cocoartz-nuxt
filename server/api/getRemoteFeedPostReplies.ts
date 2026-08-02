import { db } from '../utils/db'
import { posts, users } from '../db/schema'
import { eq } from 'drizzle-orm'

// 팔로우 피드에 뜬 원격 글에 달린 답글 목록 — 내가(혹은 같은 서버 다른 유저가) 보낸 답글(posts,
// remoteParentObjectId로 연결) + 그 답글에 원격에서 다시 달린 답글(기존 replyto 글타래 재사용)
export default eventHandler(async (event) => {
    const { objectId } = await readBody(event)
    if (!objectId) return []

    const topReplies = await db.select().from(posts).where(eq(posts.remoteParentObjectId, objectId))
    const nested = topReplies.length
        ? (await Promise.all(topReplies.map((p) => db.select().from(posts).where(eq(posts.replyto, String(p.id)))))).flat()
        : []

    const all = [...topReplies, ...nested]
    for (const item of all) {
        const u = item.userid ? await db.select().from(users).where(eq(users.id, item.userid)) : []
        ;(item as any).user = u[0] ?? null
    }

    return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})
