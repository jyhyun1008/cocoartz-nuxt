import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

// 인증 메일 속 링크(app/pages/verify-email.vue)가 호출하는 엔드포인트 — 로그인 여부와 무관하게
// 토큰 하나로만 판정함(메일함 접근 = 본인 확인이라는 이메일 인증의 일반적인 전제)
//
// ⚠️ 반드시 같은 토큰으로 여러 번 호출돼도 안전(idempotent)해야 함 — 실제로 두 가지 경로로 흔히
// 중복 호출됨: (1) 메일 서비스의 보안 스캐너(Safe Links 등)가 사용자가 열어보기도 전에 링크를
// 미리 방문해서 소비해버리는 경우, (2) verify-email.vue가 top-level await로 fetch하면 SSR에서
// 한 번, 클라이언트 하이드레이션에서 또 한 번 — 총 두 번 호출됨. 그래서 성공 시 토큰을 지우지
// 않고 남겨둠 — 이미 인증된 유저가 같은 토큰으로 또 오면(위 두 경우 다 해당) 만료 여부와 무관하게
// 그냥 성공으로 응답함. 토큰을 계속 들고 있어도 인증 완료 후엔 그걸로 할 수 있는 일이 없어서 안전함.
export default eventHandler(async (event) => {
    const { token } = await readBody(event)
    if (!token || typeof token !== 'string') throw createError({ statusCode: 400, message: '유효하지 않은 링크입니다' })

    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token))
    if (!user) throw createError({ statusCode: 400, message: '유효하지 않거나 이미 사용된 링크입니다' })

    if (user.emailVerifiedAt) return { ok: true, username: user.username }

    if (!user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt.getTime() < Date.now()) {
        throw createError({ statusCode: 400, message: '인증 링크가 만료되었습니다. 다시 전송해주세요' })
    }

    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id))

    return { ok: true, username: user.username }
})
