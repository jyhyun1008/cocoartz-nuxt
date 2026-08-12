import crypto from 'crypto'
import { db } from './db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { sendMail } from './mailer'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 재설정 링크 유효시간 1시간(인증 메일의 24시간보다 짧게 —
// 비밀번호를 바꿀 수 있는 링크라 유출/재사용 창을 더 좁게 둠)
const RESEND_COOLDOWN_MS = 60 * 1000 // 재요청 버튼 남용 방지용 최소 간격(emailVerification.ts와 동일)

// 토큰 발급 + 메일 발송 — requestPasswordReset.ts에서 씀. sendMail이 실패해도(SMTP 미설정/오류)
// throw하지 않고 결과만 반환함 — 호출부가 "이메일이 있든 없든, 발송이 되든 안 되든 항상 같은
// 응답"을 유지하기 위해 결과를 굳이 클라이언트에 노출하지 않음(계정 존재 여부 유추 방지)
export async function issueAndSendPasswordResetEmail(
    user: { id: number; email: string; username: string },
    domain: string,
) {
    const token = crypto.randomBytes(32).toString('hex')
    await db.update(users).set({
        passwordResetToken: token,
        passwordResetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        passwordResetSentAt: new Date(),
    }).where(eq(users.id, user.id))

    const link = `https://${domain}/reset-password?token=${token}`
    return sendMail({
        to: user.email,
        subject: '비밀번호 재설정 안내',
        text: `${user.username}님, 아래 링크를 열어 새 비밀번호를 설정해주세요(1시간 동안 유효).\n본인이 요청하지 않았다면 이 메일은 무시하셔도 됩니다.\n${link}`,
        html: `<p>${user.username}님, 아래 버튼을 눌러 새 비밀번호를 설정해주세요(1시간 동안 유효).</p><p>본인이 요청하지 않았다면 이 메일은 무시하셔도 됩니다.</p><p><a href="${link}">비밀번호 재설정하기</a></p>`,
    })
}

export function canResendPasswordReset(user: { passwordResetSentAt: Date | null }): boolean {
    if (!user.passwordResetSentAt) return true
    return Date.now() - user.passwordResetSentAt.getTime() > RESEND_COOLDOWN_MS
}
