import { db } from '../../utils/db'
import { users, servers, currencyBalances, items, userItems } from '../../db/schema'
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

    // 가입 보너스 지급 여부에도 필요해서 첫 유저든 아니든 항상 서버 row를 조회함
    const config = useRuntimeConfig()
    const slug = config.public.serverSlug as string
    const [server] = await db.select().from(servers).where(eq(servers.slug, slug))

    let approved = true
    if (!isFirstUser) {
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

    // 가입 보너스 — 로그인 가능 여부(승인 대기 포함)와 무관하게 계정 생성 시점에 바로 지급
    if (server?.id && server.signupBonus > 0) {
        await db.insert(currencyBalances).values({
            userid: newUser.id, serverid: server.id, balance: server.signupBonus,
        }).onConflictDoNothing()
    }

    // 관리자가 "가입 시 기본 지급"으로 표시해둔 아이템(WindowSettings.vue 상점 관리)을 전부 지급 —
    // 카테고리 전체가 아니라 items.isDefault 플래그 기준이라, 나중에 유료 헤어 스타일을 추가해도
    // 이 플래그를 안 켰으면 공짜로 안 나감
    const starterItems = await db.select({ id: items.id }).from(items)
        .where(eq(items.isDefault, true))
    if (starterItems.length) {
        await db.insert(userItems)
            .values(starterItems.map(i => ({ userid: newUser.id, itemid: i.id, count: 1 })))
            .onConflictDoNothing()
    }

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
