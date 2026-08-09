import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
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

    const [updated] = await db.update(users)
        .set({ suspendedUntil: null, suspendReason: null })
        .where(eq(users.id, id))
        .returning()
    if (!updated) throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })

    return { ok: true }
})
