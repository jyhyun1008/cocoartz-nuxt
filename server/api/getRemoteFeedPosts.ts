import { db } from '../utils/db'
import { remoteTimelinePosts, remoteTimelinePostLikes } from '../db/schema'
import { desc, and, eq, inArray, sql } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter, getWordMuteLookup, applyWordMuteFilter } from '../utils/mutes'

const PAGE_SIZE = 20

// 연합 게시판 — 로컬 유저 중 누군가가 팔로우해서 인박스로 받은 공개 원격 글을 서버 전체가 공유하는
// 연합 타임라인(remoteTimelinePosts)에서 그대로 보여줌. 로그인 여부와 무관하게 조회 가능하고,
// viewerUserId가 있으면 그 사람이 좋아요했는지만 추가로 표시해줌
export default eventHandler(async (event) => {
    const { viewerUserId, offset } = await readBody(event)

    // 재게시된 글은 원본 published가 아니라 "우리 서버가 그 재게시를 받은 시각"(createdAt)
    // 기준으로 정렬 — getFollowingFeed.ts와 동일한 이유(옛날 글이 방금 리부스트돼도 그 시점
    // 기준으로 위로 올라와야 함)
    const remoteSortDate = sql`CASE WHEN ${remoteTimelinePosts.boostedByActorUrl} IS NOT NULL THEN ${remoteTimelinePosts.createdAt} ELSE ${remoteTimelinePosts.published} END`
    const rows = await db.select().from(remoteTimelinePosts)
        .orderBy(desc(remoteSortDate))
        .limit(PAGE_SIZE + 1)
        .offset(offset ?? 0)

    const hasMore = rows.length > PAGE_SIZE
    let posts = rows.slice(0, PAGE_SIZE) as Array<typeof rows[number] & { liked: boolean }>
    // 프론트(WindowBoard.vue)가 표시/정렬 둘 다 post.published를 그대로 씀 — 서버에서 미리
    // "효과적인 날짜"로 바꿔서 내려주면 프론트를 안 건드려도 됨
    for (const post of posts) {
        if (post.boostedByActorUrl) post.published = post.createdAt
    }

    const muteLookup = await getMuteLookup(viewerUserId)
    posts = applyMuteFilter(posts, muteLookup, (p) => ({ actorUrl: p.sourceActorUrl }))
    const wordMuteLookup = await getWordMuteLookup(viewerUserId)
    posts = applyWordMuteFilter(posts, wordMuteLookup, (p) => p.content)

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
