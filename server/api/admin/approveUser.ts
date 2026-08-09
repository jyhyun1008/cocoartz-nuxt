import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { sendMail } from '../../utils/mailer'
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

    const [updated] = await db.update(users).set({ approved: true }).where(eq(users.id, id)).returning()
    if (!updated) throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })

    // 이메일 설정이 안 됐거나 실패해도 승인 처리 자체엔 영향 없음
    const config = useRuntimeConfig()
    void sendMail({
        to: updated.email,
        subject: '가입이 승인되었습니다',
        text: `${updated.knownas || updated.username}님, 가입 신청이 승인됐어요! https://${config.domain} 에서 로그인해보세요.`,
    }).catch(() => {})

    return { ok: true }
})
