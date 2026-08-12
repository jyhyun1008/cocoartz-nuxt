import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { kickUserConnections } from '../../routes/_ws'
import { apiError } from '../../utils/apiError'

// 메일 속 링크(app/pages/reset-password.vue)에서 새 비밀번호를 입력하고 제출하면 호출됨.
// verifyEmail.ts와 달리 단순 링크 방문이 아니라 "새 비밀번호를 입력해서 제출"하는 액션이라
// 메일 보안 스캐너가 미리 링크만 열어봐도(GET) 이 API(POST)까진 안 타므로, 여기는 굳이
// idempotent하게 안 만들고 정상적으로 1회용 토큰으로 처리함(성공하면 토큰을 지움)
export default eventHandler(async (event) => {
    const { token, password } = await readBody(event)
    if (!token || typeof token !== 'string') throw apiError(400, 'INVALID_LINK', '유효하지 않은 링크입니다')
    if (!password || password.length < 6) throw apiError(400, 'PASSWORD_TOO_SHORT', '비밀번호는 6자 이상이어야 합니다')

    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token))
    if (!user) throw apiError(400, 'INVALID_LINK', '유효하지 않거나 이미 사용된 링크입니다')
    if (!user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
        throw apiError(400, 'LINK_EXPIRED', '재설정 링크가 만료되었습니다. 다시 요청해주세요')
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    await db.update(users).set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        // 메일함에 온 링크로 비밀번호를 바꿨다는 건 그 메일함 접근 권한을 증명한 셈이라, 아직
        // 이메일 미인증 상태였다면 이 김에 같이 인증 처리해줌(따로 인증 메일을 또 받을 필요 없게)
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    }).where(eq(users.id, user.id))

    // 계정이 탈취당해서 재설정하는 경우를 대비해, 지금 맵에 붙어있는 세션(들)을 끊어서 새
    // 비밀번호로 다시 로그인하게 함 — HTTP 세션 쿠키 자체는 서버가 따로 무효화할 저장소가
    // 없어서(iron으로 봉인된 쿠키뿐) 못 끊지만, 실시간 연결만이라도 정리함
    kickUserConnections(user.id, 'password_reset')

    return { ok: true, username: user.username }
})
