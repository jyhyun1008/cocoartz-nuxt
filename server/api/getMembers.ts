import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq, desc, asc } from 'drizzle-orm'

// 이 배포는 서버(커뮤니티) 1개짜리 단일 테넌트 구조라 users 테이블 전체가 곧 "이 서버의 멤버"임
// (schema.ts의 members 테이블은 멀티서버용으로 미리 만들어둔 스키마인데 실제로는 어디서도 채워지지
// 않는 미사용 테이블이라, 여기서는 그 대신 users를 그대로 멤버 목록으로 씀)
export default eventHandler(async () => {
    return db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        bio: users.bio,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
    }).from(users)
        .where(eq(users.approved, true))
        .orderBy(desc(users.isAdmin), asc(users.createdAt))
})
