import { db } from '../utils/db'
import { remoteFeedPosts } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const PAGE_SIZE = 20

// 연합 게시판에 로그인 유저 본인이 팔로우한 원격 계정의 글을 같이 띄우기 위한 용도
export default eventHandler(async (event) => {
    const { userid, offset } = await readBody(event)
    if (!userid) return { posts: [], hasMore: false }

    const rows = await db.select().from(remoteFeedPosts)
        .where(eq(remoteFeedPosts.userid, userid))
        .orderBy(desc(remoteFeedPosts.published))
        .limit(PAGE_SIZE + 1)
        .offset(offset ?? 0)

    const hasMore = rows.length > PAGE_SIZE
    return { posts: rows.slice(0, PAGE_SIZE), hasMore }
})
