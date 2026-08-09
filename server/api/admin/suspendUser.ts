import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { kickUserConnections } from '../../routes/_ws'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { id, until, reason } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)
    if (!id) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })
    const untilDate = until ? new Date(until) : null
    if (!untilDate || Number.isNaN(untilDate.getTime()) || untilDate.getTime() <= Date.now()) {
        throw createError({ statusCode: 400, message: '올바른 미래 시각이 필요합니다' })
    }

    const [updated] = await db.update(users)
        .set({ suspendedUntil: untilDate, suspendReason: reason?.trim() || null })
        .where(eq(users.id, id))
        .returning()
    if (!updated) throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })

    // 이미 접속 중인 세션도 그 자리에서 끊음(즉시 차단)
    kickUserConnections(id)

    return { ok: true }
})
