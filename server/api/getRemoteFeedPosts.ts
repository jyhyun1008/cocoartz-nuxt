import { db } from '../utils/db'
import { remoteFeedPosts } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'

const PAGE_SIZE = 20

// 연합 게시판에 로그인 유저 본인이 팔로우한 원격 계정의 글을 같이 띄우기 위한 용도
// 게시판은 다들 보는 공개 공간이라 전체공개(isPublic)인 글만 노출 — 홈 공개/팔로워 공개는 제외
export default eventHandler(async (event) => {
    const { userid, offset } = await readBody(event)
    if (!userid) return { posts: [], hasMore: false }

    const rows = await db.select().from(remoteFeedPosts)
        .where(and(eq(remoteFeedPosts.userid, userid), eq(remoteFeedPosts.isPublic, true)))
        .orderBy(desc(remoteFeedPosts.published))
        .limit(PAGE_SIZE + 1)
        .offset(offset ?? 0)

    const hasMore = rows.length > PAGE_SIZE
    return { posts: rows.slice(0, PAGE_SIZE), hasMore }
})
