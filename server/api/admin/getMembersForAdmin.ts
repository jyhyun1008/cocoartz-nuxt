import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { desc, asc } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

// 공개 getMembers.ts와 별개 — 정지/영구정지 여부처럼 전체 공개하면 안 되는 정보가 포함되니
// 관리자 전용으로 완전히 분리함(승인 대기 유저까지 포함해서 전체 반환)
export default eventHandler(async (event) => {
    await requirePermission(event, 'accessAdminSettings')

    return db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        isAdmin: users.isAdmin,
        permissions: users.permissions,
        approved: users.approved,
        bannedAt: users.bannedAt,
        banReason: users.banReason,
        suspendedUntil: users.suspendedUntil,
        suspendReason: users.suspendReason,
        createdAt: users.createdAt,
    }).from(users)
        .orderBy(desc(users.isAdmin), asc(users.createdAt))
})
