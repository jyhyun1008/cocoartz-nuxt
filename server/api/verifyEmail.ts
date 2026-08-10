import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

// 인증 메일 속 링크(app/pages/verify-email.vue)가 호출하는 엔드포인트 — 로그인 여부와 무관하게
// 토큰 하나로만 판정함(메일함 접근 = 본인 확인이라는 이메일 인증의 일반적인 전제)
export default eventHandler(async (event) => {
    const { token } = await readBody(event)
    if (!token || typeof token !== 'string') throw createError({ statusCode: 400, message: '유효하지 않은 링크입니다' })

    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token))
    if (!user) throw createError({ statusCode: 400, message: '유효하지 않거나 이미 사용된 링크입니다' })
    if (!user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt.getTime() < Date.now()) {
        throw createError({ statusCode: 400, message: '인증 링크가 만료되었습니다. 다시 전송해주세요' })
    }

    await db.update(users).set({
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
    }).where(eq(users.id, user.id))

    return { ok: true, username: user.username }
})
