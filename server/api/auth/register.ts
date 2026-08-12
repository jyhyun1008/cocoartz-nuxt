import { db } from '../../utils/db'
import { users, servers, currencyBalances, items, userItems } from '../../db/schema'
import { eq, or, count } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { sendMail } from '../../utils/mailer'
import { createAuthSession } from '../../utils/session'
import { isEmailVerificationRequired, issueAndSendVerificationEmail } from '../../utils/emailVerification'
import { apiError } from '../../utils/apiError'

export default eventHandler(async (event) => {
    const { username, email, password } = await readBody(event)

    if (!username?.trim() || !email?.trim() || !password?.trim()) {
        throw apiError(400, 'MISSING_FIELDS', '모든 필드를 입력해주세요')
    }

    if (password.length < 6) {
        throw apiError(400, 'PASSWORD_TOO_SHORT', '비밀번호는 6자 이상이어야 합니다')
    }

    const existing = await db.select().from(users).where(
        or(eq(users.email, email.trim()), eq(users.username, username.trim()))
    )
    if (existing.length > 0) {
        const emailTaken = existing[0].email === email.trim()
        throw emailTaken
            ? apiError(409, 'EMAIL_TAKEN', '이미 사용 중인 이메일입니다')
            : apiError(409, 'USERNAME_TAKEN', '이미 사용 중인 아이디입니다')
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
            throw apiError(403, 'REGISTRATION_CLOSED', '현재 신규 가입이 제한되어 있습니다')
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

    // 이메일 인증 메일 — SMTP를 설정해둔 서버에서만 의미가 있어서(안 그러면 영영 미인증 상태에
    // 갇힘), 아예 꺼져있으면 토큰 발급/발송 자체를 스킵함. 발송 자체가 실패해도(SMTP 오류 등)
    // 가입은 그대로 진행됨 — 아래에서 verificationRequired를 봐서 로그인 게이트만 별도로 걺
    const verificationRequired = await isEmailVerificationRequired()
    if (verificationRequired) {
        void issueAndSendVerificationEmail(
            { id: newUser.id, email: email.trim(), username: newUser.username },
            config.domain as string,
        ).catch((e) => console.error('[register] 이메일 인증 메일 발송 실패', e))
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

    // 이메일 인증이 실제 로그인 게이트가 되는 지점 — 부트스트랩 첫 유저(=자동 관리자)는 예외로
    // 봐줌: 아직 관리자가 아예 없는 상태에서 이 계정 자체가 막히면 아무도 관리자 설정(이메일
    // 설정 포함)에 못 들어가는 죽음의 순환이 생김. 나중에 본인이 원하면 메일 속 링크로 인증하면
    // 됨(login.ts가 isAdmin 계정은 이 게이트를 계속 봐주므로 안 해도 무방하긴 함)
    if (verificationRequired && !isFirstUser) {
        return { id: newUser.id, username: newUser.username, pendingVerification: true }
    }

    setCookie(event, 'user-id', String(newUser.id), {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
    })
    await createAuthSession(event, newUser.id)

    return { id: newUser.id, username: newUser.username }
})
