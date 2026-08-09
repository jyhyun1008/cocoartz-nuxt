import { db } from '../../utils/db'
import { users, emailSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    const [row] = await db.select().from(emailSettings).limit(1)
    if (!row) {
        return { smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPasswordSet: false, fromAddress: '', fromName: '', enabled: false }
    }

    // smtpPassword 원문은 절대 다시 클라이언트로 안 내려주고, 설정 여부만 알려줌
    const { smtpPassword, ...rest } = row
    return { ...rest, smtpPasswordSet: !!smtpPassword }
})
