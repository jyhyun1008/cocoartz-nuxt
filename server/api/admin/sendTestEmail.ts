import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { sendMail } from '../../utils/mailer'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select().from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
    return user
}

// 임의 수신자를 받지 않고 요청한 관리자 본인 이메일로만 보냄 — 오픈 릴레이처럼 악용될 여지 차단
export default eventHandler(async (event) => {
    const userid = await requireUserId(event)
    const admin = await checkAdmin(userid)

    const result = await sendMail({
        to: admin.email,
        subject: '[코코아츠] 테스트 메일',
        text: '이메일 설정이 정상적으로 동작하고 있어요!',
    })
    return result
})
