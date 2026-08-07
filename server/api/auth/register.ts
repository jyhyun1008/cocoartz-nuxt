import { db } from '../../utils/db'
import { users, servers } from '../../db/schema'
import { eq, or, count } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { sendMail } from '../../utils/mailer'

export default eventHandler(async (event) => {
    const { username, email, password } = await readBody(event)

    if (!username?.trim() || !email?.trim() || !password?.trim()) {
        throw createError({ statusCode: 400, message: '모든 필드를 입력해주세요' })
    }

    if (password.length < 6) {
        throw createError({ statusCode: 400, message: '비밀번호는 6자 이상이어야 합니다' })
    }

    const existing = await db.select().from(users).where(
        or(eq(users.email, email.trim()), eq(users.username, username.trim()))
    )
    if (existing.length > 0) {
        const field = existing[0].email === email.trim() ? '이메일' : '아이디'
        throw createError({ statusCode: 409, message: `이미 사용 중인 ${field}입니다` })
    }

    // 첫 번째 가입 유저에게 어드민 자동 부여 — 관리자가 아직 없는 상태이므로
    // 가입 모드(차단/승인제)와 무관하게 항상 통과시켜야 부트스트랩이 가능함
    const [{ value: userCount }] = await db.select({ value: count() }).from(users)
    const isFirstUser = Number(userCount) === 0

    let approved = true
    if (!isFirstUser) {
        const config = useRuntimeConfig()
        const slug = config.public.serverSlug as string
        const [server] = await db.select().from(servers).where(eq(servers.slug, slug))
        const mode = server?.registrationMode ?? 'open'

        if (mode === 'closed') {
            throw createError({ statusCode: 403, message: '현재 신규 가입이 제한되어 있습니다' })
        }
        approved = mode !== 'approval'
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const [newUser] = await db.insert(users).values({
        username: username.trim(),
        email: email.trim(),
        password: hashedPassword,
        knownas: username.trim(),
        isAdmin: isFirstUser,
        approved,
    }).returning({ id: users.id, username: users.username })

    if (!approved) {
        // 관리자들에게 새 가입 신청을 알림 — 이메일 설정이 안 됐거나 실패해도 가입 신청 자체엔 영향 없음
        const admins = await db.select({ email: users.email }).from(users).where(eq(users.isAdmin, true))
        for (const admin of admins) {
            void sendMail({
                to: admin.email,
                subject: `[가입 신청] ${username.trim()}님이 가입을 신청했습니다`,
                text: `${username.trim()}(${email.trim()})님이 가입을 신청했어요. 관리자 설정의 "가입 승인" 탭에서 승인/거절할 수 있어요.`,
            }).catch(() => {})
        }
        return { id: newUser.id, username: newUser.username, pendingApproval: true }
    }

    setCookie(event, 'user-id', String(newUser.id), {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
    })

    return { id: newUser.id, username: newUser.username }
})
