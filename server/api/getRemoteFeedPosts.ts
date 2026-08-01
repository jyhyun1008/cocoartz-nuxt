import { db } from '../utils/db'
import { remoteFeedPosts } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

// 연합 게시판에 로그인 유저 본인이 팔로우한 원격 계정의 글을 같이 띄우기 위한 용도
export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) return []
    return db.select().from(remoteFeedPosts)
        .where(eq(remoteFeedPosts.userid, userid))
        .orderBy(desc(remoteFeedPosts.published))
        .limit(50)
})
