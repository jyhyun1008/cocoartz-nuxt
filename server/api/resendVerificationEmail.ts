import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../utils/session'
import { isEmailVerificationRequired, isVerified, canResend, issueAndSendVerificationEmail } from '../utils/emailVerification'

export default eventHandler(async (event) => {
    const userid = await requireUserId(event)

    const required = await isEmailVerificationRequired()
    if (!required) throw createError({ statusCode: 400, message: '이 서버는 이메일 인증을 사용하지 않습니다' })

    const [user] = await db.select().from(users).where(eq(users.id, userid))
    if (!user) throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })
    if (isVerified(user, required)) throw createError({ statusCode: 400, message: '이미 인증된 계정입니다' })
    if (!canResend(user)) throw createError({ statusCode: 429, message: '잠시 후 다시 시도해주세요' })

    const config = useRuntimeConfig()
    const result = await issueAndSendVerificationEmail(
        { id: user.id, email: user.email, username: user.username },
        config.domain as string,
    )
    if (!result.ok) throw createError({ statusCode: 502, message: result.error || '메일 발송에 실패했습니다' })

    return { ok: true }
})
