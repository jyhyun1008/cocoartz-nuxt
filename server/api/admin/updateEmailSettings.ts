import { db } from '../../utils/db'
import { users, emailSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, fromAddress, fromName, enabled } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    const [existing] = await db.select().from(emailSettings).limit(1)

    // 비밀번호는 빈 값으로 오면 기존 값을 그대로 유지(매번 다시 안 쳐도 되게)
    const passwordToSet = smtpPassword ? smtpPassword : (existing?.smtpPassword ?? null)

    const values = {
        smtpHost: smtpHost?.trim() || null,
        smtpPort: smtpPort ? Number(smtpPort) : 587,
        smtpSecure: !!smtpSecure,
        smtpUser: smtpUser?.trim() || null,
        smtpPassword: passwordToSet,
        fromAddress: fromAddress?.trim() || null,
        fromName: fromName?.trim() || null,
        enabled: !!enabled,
    }

    if (!existing) {
        const [created] = await db.insert(emailSettings).values(values).returning()
        const { smtpPassword: _pw, ...rest } = created
        return { ...rest, smtpPasswordSet: !!created.smtpPassword }
    }

    const [updated] = await db.update(emailSettings).set(values).where(eq(emailSettings.id, existing.id)).returning()
    const { smtpPassword: _pw2, ...rest } = updated
    return { ...rest, smtpPasswordSet: !!updated.smtpPassword }
})
