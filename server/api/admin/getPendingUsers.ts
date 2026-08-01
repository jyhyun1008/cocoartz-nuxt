import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    await checkAdmin(userid)

    return db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        knownas: users.knownas,
        avatar: users.avatar,
        createdAt: users.createdAt,
    }).from(users)
        .where(and(eq(users.approved, false), eq(users.isAdmin, false)))
        .orderBy(desc(users.createdAt))
})
