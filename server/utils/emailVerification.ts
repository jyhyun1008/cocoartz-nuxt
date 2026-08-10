import crypto from 'crypto'
import { db } from './db'
import { users, emailSettings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { sendMail } from './mailer'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 인증 링크 유효시간 24시간
const RESEND_COOLDOWN_MS = 60 * 1000 // 재전송 버튼 남용 방지용 최소 간격

// SMTP가 아예 꺼져있으면(관리자가 설정 안 했거나 일부러 끔) 인증 메일 자체를 보낼 방법이 없음 —
// 이럴 땐 인증을 "요구하지 않음"으로 취급해서, 미인증 배지가 영원히 붙어있거나 재전송이 계속
// 실패하는 상황을 막음. 즉 이메일 인증은 순전히 SMTP를 설정해둔 서버에서만 의미가 있는 소프트 기능.
export async function isEmailVerificationRequired(): Promise<boolean> {
    const [settings] = await db.select({ enabled: emailSettings.enabled }).from(emailSettings).limit(1)
    return !!settings?.enabled
}

// required=false(SMTP 미설정)면 emailVerifiedAt 값과 무관하게 항상 인증된 것으로 봄
export function isVerified(user: { emailVerifiedAt: Date | null }, required: boolean): boolean {
    return !required || !!user.emailVerifiedAt
}

// 토큰 발급 + 메일 발송을 한 번에 — 회원가입 직후, 그리고 재전송 버튼에서 공용으로 씀.
// sendMail이 실패해도(SMTP 오류 등) throw하지 않고 그대로 결과를 반환함 — 호출부가 판단해서 처리
export async function issueAndSendVerificationEmail(
    user: { id: number; email: string; username: string },
    domain: string,
) {
    const token = crypto.randomBytes(32).toString('hex')
    await db.update(users).set({
        emailVerificationToken: token,
        emailVerificationTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        emailVerificationSentAt: new Date(),
    }).where(eq(users.id, user.id))

    const link = `https://${domain}/verify-email?token=${token}`
    return sendMail({
        to: user.email,
        subject: '이메일 인증을 완료해주세요',
        text: `${user.username}님, 아래 링크를 열어 이메일 인증을 완료해주세요(24시간 동안 유효):\n${link}`,
        html: `<p>${user.username}님, 아래 버튼을 눌러 이메일 인증을 완료해주세요(24시간 동안 유효).</p><p><a href="${link}">이메일 인증하기</a></p>`,
    })
}

export function canResend(user: { emailVerificationSentAt: Date | null }): boolean {
    if (!user.emailVerificationSentAt) return true
    return Date.now() - user.emailVerificationSentAt.getTime() > RESEND_COOLDOWN_MS
}
