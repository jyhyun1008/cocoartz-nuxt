import { db } from '../../utils/db'
import { servers, users } from '../../db/schema'
import { eq } from 'drizzle-orm'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { userid, slug, title, themecolor, info, avatar } = await readBody(event)
    await checkAdmin(userid)

    const [updated] = await db.update(servers)
        .set({
            ...(title !== undefined ? { title: title.trim() } : {}),
            ...(themecolor !== undefined ? { themecolor: themecolor.trim() || null } : {}),
            ...(info !== undefined ? { info: info.trim() || null } : {}),
            ...(avatar !== undefined ? { avatar: avatar.trim() || null } : {}),
        })
        .where(eq(servers.slug, slug))
        .returning()
    return updated
})
