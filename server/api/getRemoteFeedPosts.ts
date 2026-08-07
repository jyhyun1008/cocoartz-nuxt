import { db } from '../utils/db'
import { remoteTimelinePosts, remoteTimelinePostLikes } from '../db/schema'
import { desc, and, eq, inArray } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter } from '../utils/mutes'

const PAGE_SIZE = 20

// 연합 게시판 — 로컬 유저 중 누군가가 팔로우해서 인박스로 받은 공개 원격 글을 서버 전체가 공유하는
// 연합 타임라인(remoteTimelinePosts)에서 그대로 보여줌. 로그인 여부와 무관하게 조회 가능하고,
// viewerUserId가 있으면 그 사람이 좋아요했는지만 추가로 표시해줌
export default eventHandler(async (event) => {
    const { viewerUserId, offset } = await readBody(event)

    const rows = await db.select().from(remoteTimelinePosts)
        .orderBy(desc(remoteTimelinePosts.published))
        .limit(PAGE_SIZE + 1)
        .offset(offset ?? 0)

    const hasMore = rows.length > PAGE_SIZE
    let posts = rows.slice(0, PAGE_SIZE) as Array<typeof rows[number] & { liked: boolean }>

    const muteLookup = await getMuteLookup(viewerUserId)
    posts = applyMuteFilter(posts, muteLookup, (p) => ({ actorUrl: p.sourceActorUrl }))

    if (viewerUserId && posts.length) {
        const ids = posts.map((p) => p.id)
        const likedRows = await db.select({ remoteTimelinePostId: remoteTimelinePostLikes.remoteTimelinePostId })
            .from(remoteTimelinePostLikes)
            .where(and(inArray(remoteTimelinePostLikes.remoteTimelinePostId, ids), eq(remoteTimelinePostLikes.userid, viewerUserId)))
        const likedSet = new Set(likedRows.map((r) => r.remoteTimelinePostId))
        for (const post of posts) post.liked = likedSet.has(post.id)
    } else {
        for (const post of posts) post.liked = false
    }

    return { posts, hasMore }
})
