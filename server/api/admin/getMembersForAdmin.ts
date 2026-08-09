import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq, desc, asc } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// 공개 getMembers.ts와 별개 — 정지/영구정지 여부처럼 전체 공개하면 안 되는 정보가 포함되니
// 관리자 전용으로 완전히 분리함(승인 대기 유저까지 포함해서 전체 반환)
export default eventHandler(async (event) => {
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    return db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        isAdmin: users.isAdmin,
        approved: users.approved,
        bannedAt: users.bannedAt,
        banReason: users.banReason,
        suspendedUntil: users.suspendedUntil,
        suspendReason: users.suspendReason,
        createdAt: users.createdAt,
    }).from(users)
        .orderBy(desc(users.isAdmin), asc(users.createdAt))
})
