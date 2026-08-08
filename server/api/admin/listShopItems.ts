import { db } from '../../utils/db'
import { users, items } from '../../db/schema'
import { eq } from 'drizzle-orm'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// 상점 진열용 getShopCatalog.ts와 달리 active=false인 것까지 전부 내려줌(관리용 전체 목록)
export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    await checkAdmin(userid)

    return await db.select().from(items).orderBy(items.category, items.id)
})
