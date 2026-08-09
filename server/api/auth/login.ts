import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getUserBlockStatus } from '../../utils/userStatus'
import { createAuthSession } from '../../utils/session'

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

    const status = getUserBlockStatus(user)
    if (status.blocked) {
        throw createError({
            statusCode: 403,
            message: status.kind === 'banned' ? '영구정지된 계정입니다' : '일시정지된 계정입니다',
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
