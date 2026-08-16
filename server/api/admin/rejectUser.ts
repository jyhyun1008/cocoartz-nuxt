import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { id } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')
    if (!id) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })

    // 승인 대기 상태인 가입 신청만 거절(삭제) 가능 — 이미 승인된 계정을 실수로 지우는 것 방지
    const [deleted] = await db.delete(users)
        .where(and(eq(users.id, id), eq(users.approved, false)))
        .returning()
    if (!deleted) throw createError({ statusCode: 404, message: '승인 대기 중인 유저를 찾을 수 없습니다' })
    return { ok: true }
})
