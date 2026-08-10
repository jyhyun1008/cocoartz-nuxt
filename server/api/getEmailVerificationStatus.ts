import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getOptionalUserId } from '../utils/session'
import { isEmailVerificationRequired, isVerified } from '../utils/emailVerification'

// 내 설정(WindowPreferences.vue)의 이메일 인증 배지/재전송 버튼용 상태 조회
export default eventHandler(async (event) => {
    const userid = await getOptionalUserId(event)
    if (!userid) return { required: false, verified: true }

    const [user] = await db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userid))
    if (!user) return { required: false, verified: true }

    const required = await isEmailVerificationRequired()
    return { required, verified: isVerified(user, required) }
})
