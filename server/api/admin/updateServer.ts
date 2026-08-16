import { db } from '../../utils/db'
import { servers, emailSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

const REGISTRATION_MODES = ['open', 'approval', 'closed']

export default eventHandler(async (event) => {
    const { slug, title, themecolor, info, avatar, registrationMode, currencyName, signupBonus, reservedUsernames } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')
    if (!slug) throw createError({ statusCode: 400, message: 'slug가 필요합니다' })
    if (registrationMode !== undefined && !REGISTRATION_MODES.includes(registrationMode)) {
        throw createError({ statusCode: 400, message: '올바르지 않은 가입 방식입니다' })
    }
    // 가입을 열면(open/approval) 인증 메일·비밀번호 재설정 메일이 실제로 나가야 하는데, 이메일이
    // 설정 안 된 채로 가입을 받으면 신규 유저가 인증 자체를 못 하거나(register.ts의 인증 게이트)
    // 비밀번호를 잊었을 때 되찾을 방법이 없어짐 — 그래서 이메일 설정(mailer.ts가 발송 가능하다고
    // 보는 기준과 동일: enabled + smtpHost/smtpUser/smtpPassword)이 안 끝났으면 아예 못 열게 막음
    if (registrationMode === 'open' || registrationMode === 'approval') {
        const [mail] = await db.select().from(emailSettings).limit(1)
        const mailReady = !!(mail?.enabled && mail.smtpHost && mail.smtpUser && mail.smtpPassword)
        if (!mailReady) {
            throw createError({ statusCode: 400, message: '이메일 설정을 먼저 완료해야 가입을 열 수 있어요(설정 > 이메일 탭)' })
        }
    }
    if (signupBonus !== undefined && (!Number.isInteger(signupBonus) || signupBonus < 0)) {
        throw createError({ statusCode: 400, message: '가입 보너스는 0 이상의 정수여야 합니다' })
    }

    const [existing] = await db.select().from(servers).where(eq(servers.slug, slug))

    // SERVER_SLUG에 해당하는 servers row가 아직 없는 배포(seed를 안 돌린 경우 등)에서는
    // UPDATE가 0 rows에 매칭되어 조용히 아무 일도 안 하고 성공 응답만 가던 문제가 있었음 → 없으면 생성
    if (!existing) {
        const [created] = await db.insert(servers).values({
            slug,
            title: title?.trim() || slug,
            themecolor: themecolor?.trim() || null,
            info: info?.trim() || null,
            avatar: avatar?.trim() || null,
            ...(registrationMode !== undefined ? { registrationMode } : {}),
            currencyName: currencyName?.trim() || '코코아',
            ...(signupBonus !== undefined ? { signupBonus } : {}),
            ...(reservedUsernames !== undefined ? { reservedUsernames } : {}),
        }).returning()
        return created
    }

    const [updated] = await db.update(servers)
        .set({
            ...(title !== undefined ? { title: title.trim() } : {}),
            ...(themecolor !== undefined ? { themecolor: themecolor.trim() || null } : {}),
            ...(info !== undefined ? { info: info.trim() || null } : {}),
            ...(avatar !== undefined ? { avatar: avatar.trim() || null } : {}),
            ...(registrationMode !== undefined ? { registrationMode } : {}),
            ...(currencyName !== undefined ? { currencyName: currencyName.trim() || '코코아' } : {}),
            ...(signupBonus !== undefined ? { signupBonus } : {}),
            ...(reservedUsernames !== undefined ? { reservedUsernames } : {}),
        })
        .where(eq(servers.slug, slug))
        .returning()
    return updated
})
