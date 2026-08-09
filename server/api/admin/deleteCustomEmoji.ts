import { db } from '../../utils/db'
import { users, customEmojis } from '../../db/schema'
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
    if (!id) throw createError({ statusCode: 400, message: 'id가 필요합니다' })

    // 이미 쓰인 글/댓글/리액션은 그대로 두고(:shortcode: 리터럴 텍스트로 자연스럽게 폴백),
    // 이모지 정의만 지움 — 원격 이모지 캐시가 만료됐을 때와 동일한 동작
    await db.delete(customEmojis).where(eq(customEmojis.id, id))
    return { success: true }
})
