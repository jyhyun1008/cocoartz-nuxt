import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getUserBlockStatus } from '../../utils/userStatus'
import { createAuthSession } from '../../utils/session'
import { isEmailVerificationRequired, isVerified } from '../../utils/emailVerification'

export default eventHandler(async (event) => {
    const { email, password } = await readBody(event)

    if (!email?.trim() || !password?.trim()) {
        throw createError({ statusCode: 400, message: '이메일과 비밀번호를 입력해주세요' })
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.trim()))
    if (!user) {
        throw createError({ statusCode: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다' })
    }

    if (!user.password) {
        throw createError({ statusCode: 401, message: '비밀번호가 설정되지 않은 계정입니다' })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
        throw createError({ statusCode: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다' })
    }

    if (!user.approved) {
        throw createError({ statusCode: 403, message: '관리자 승인 대기 중인 계정입니다' })
    }

    // 이메일 인증 게이트 — SMTP가 켜진 서버의 신규 가입자(register.ts 참고)만 실제로 걸림.
    // isAdmin 계정은 항상 예외(관리자가 메일 문제로 자기 서버에서 통째로 로그아웃되는 사고를
    // 막기 위함) — 이 서버에서 isAdmin은 사실상 부트스트랩 첫 유저와 동의어라 범위가 넓어지진
    // 않음. 마이그레이션 시점에 기존 유저는 전부 emailVerifiedAt이 채워져 있어서(소급 인증)
    // 이 게이트 자체는 이 기능 이후 가입자에게만 실질적으로 적용됨
    if (!user.isAdmin) {
        const verificationRequired = await isEmailVerificationRequired()
        if (!isVerified(user, verificationRequired)) {
            throw createError({ statusCode: 403, message: '이메일 인증이 필요합니다. 메일함을 확인해주세요' })
        }
    }

    const status = getUserBlockStatus(user)
    if (status.blocked) {
        throw createError({
            statusCode: 403,
            message: status.kind === 'deleted' ? '탈퇴한 계정입니다' : status.kind === 'banned' ? '영구정지된 계정입니다' : '일시정지된 계정입니다',
        })
    }

    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id))

    // 'user-id'는 클라이언트가 "지금 로그인된 사람이 누구인지" UI 표시용으로만 읽는 평문 쿠키 —
    // 실제 인가는 아래 세션(서버만 복호화 가능)만 씀. 자세한 이유는 server/utils/session.ts 참고.
    setCookie(event, 'user-id', String(user.id), {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
    })
    await createAuthSession(event, user.id)

    return { id: user.id, username: user.username }
})
