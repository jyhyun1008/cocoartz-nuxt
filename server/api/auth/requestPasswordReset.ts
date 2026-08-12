import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { issueAndSendPasswordResetEmail, canResendPasswordReset } from '../../utils/passwordReset'
import { apiError } from '../../utils/apiError'

// 로그인 여부와 무관하게(당연히 못 들어가고 있어서 재설정하려는 거니) 이메일 하나로 호출.
// ⚠️ 이메일이 실제로 가입돼 있는지/발송이 실제로 됐는지와 무관하게 항상 같은 응답을 줌 —
// 응답이 달라지면 "이 이메일로 가입된 계정이 있는지"를 외부에서 무차별로 알아낼 수 있는
// 계정 존재 유추(user enumeration) 취약점이 됨
export default eventHandler(async (event) => {
    const { email } = await readBody(event)
    if (!email?.trim()) throw apiError(400, 'EMAIL_REQUIRED', '이메일을 입력해주세요')

    const config = useRuntimeConfig()
    const [user] = await db.select().from(users).where(eq(users.email, email.trim()))

    // password가 없는 계정(정상적으로는 안 생기지만 방어적으로)은 재설정할 대상 자체가 없음
    if (user && user.password && canResendPasswordReset(user)) {
        void issueAndSendPasswordResetEmail(
            { id: user.id, email: user.email, username: user.username },
            config.domain as string,
        ).catch((e) => console.error('[requestPasswordReset] 메일 발송 실패', e))
    }

    return { ok: true }
})
