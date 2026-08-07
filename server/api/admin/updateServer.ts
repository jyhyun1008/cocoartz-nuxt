import { db } from '../../utils/db'
import { servers, users } from '../../db/schema'
import { eq } from 'drizzle-orm'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

const REGISTRATION_MODES = ['open', 'approval', 'closed']

export default eventHandler(async (event) => {
    const { userid, slug, title, themecolor, info, avatar, registrationMode, currencyName } = await readBody(event)
    await checkAdmin(userid)
    if (!slug) throw createError({ statusCode: 400, message: 'slug가 필요합니다' })
    if (registrationMode !== undefined && !REGISTRATION_MODES.includes(registrationMode)) {
        throw createError({ statusCode: 400, message: '올바르지 않은 가입 방식입니다' })
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
        })
        .where(eq(servers.slug, slug))
        .returning()
    return updated
})
