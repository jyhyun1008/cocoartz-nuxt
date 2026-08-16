import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin, PERMISSION_KEYS } from '../../utils/permissions'

// 유저에게 세부 권한(deletePosts/postAnnouncements/moderateUsers/accessAdminSettings)을 부여/회수.
// ⚠️ 일부러 requirePermission(accessAdminSettings)가 아니라 requireAdmin(진짜 isAdmin)만 통과시킴 —
// 권한을 "나눠주는" 행위까지 위임하면 accessAdminSettings 보유자가 자기 자신에게 권한을 더 얹는
// 자기 확장이 가능해짐(permissions.ts의 requireAdmin 주석 참고)
export default eventHandler(async (event) => {
    await requireAdmin(event)
    const { id, permissions } = await readBody(event)
    if (!id) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })
    if (!Array.isArray(permissions) || permissions.some((p) => !PERMISSION_KEYS.includes(p))) {
        throw createError({ statusCode: 400, message: '올바르지 않은 권한 목록입니다' })
    }

    const [target] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, id))
    if (!target) throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })
    // isAdmin은 이 배열과 무관하게 이미 모든 권한을 갖고 있어서(permissions.ts의 hasPermission)
    // 여기 저장해봐야 의미가 없고, 나중에 admin을 내렸을 때 의도치 않게 권한이 남아있는 것처럼
    // 보이는 혼란만 생기므로 애초에 막아둠
    if (target.isAdmin) throw createError({ statusCode: 400, message: '전체 관리자는 이미 모든 권한을 갖고 있어요' })

    const [updated] = await db.update(users)
        .set({ permissions: permissions.length ? JSON.stringify(permissions) : null })
        .where(eq(users.id, id))
        .returning({ id: users.id, permissions: users.permissions })
    return updated
})
