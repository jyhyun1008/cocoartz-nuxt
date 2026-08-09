import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { id } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)
    if (!id) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })

    // 승인 대기 상태인 가입 신청만 거절(삭제) 가능 — 이미 승인된 계정을 실수로 지우는 것 방지
    const [deleted] = await db.delete(users)
        .where(and(eq(users.id, id), eq(users.approved, false)))
        .returning()
    if (!deleted) throw createError({ statusCode: 404, message: '승인 대기 중인 유저를 찾을 수 없습니다' })
    return { ok: true }
})
