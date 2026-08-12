import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { isEmailVerificationRequired, isVerified, canResend, issueAndSendVerificationEmail } from '../../utils/emailVerification'
import { apiError } from '../../utils/apiError'

// resendVerificationEmail.ts(로그인 상태에서 설정 화면에 쓰는 것)와 별개로, 미인증이라 로그인
// 자체가 막힌 유저를 위한 공개 버전 — 로그인을 못 하는 상태니 로그인 없이 이메일만으로 재요청함.
// requestPasswordReset.ts와 같은 이유로 계정 존재 여부를 유추 못 하게 항상 같은 응답을 줌
export default eventHandler(async (event) => {
    const { email } = await readBody(event)
    if (!email?.trim()) throw apiError(400, 'EMAIL_REQUIRED', '이메일을 입력해주세요')

    const required = await isEmailVerificationRequired()
    if (required) {
        const [user] = await db.select().from(users).where(eq(users.email, email.trim()))
        if (user && !isVerified(user, required) && canResend(user)) {
            const config = useRuntimeConfig()
            void issueAndSendVerificationEmail(
                { id: user.id, email: user.email, username: user.username },
                config.domain as string,
            ).catch((e) => console.error('[resendVerification] 메일 발송 실패', e))
        }
    }

    return { ok: true }
})
