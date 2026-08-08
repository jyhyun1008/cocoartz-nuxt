import { db } from '../utils/db'
import { items, userItems } from '../db/schema'
import { eq } from 'drizzle-orm'

// 본인 인벤토리 전용 — 다른 유저 인벤토리는 조회 API 자체가 없음(아직 남에게 보여줄 이유가 없어서)
export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    return await db.select({
        itemid: items.id,
        category: items.category,
        itemKey: items.itemKey,
        name: items.name,
        description: items.description,
        icon: items.icon,
        meta: items.meta,
        count: userItems.count,
    }).from(userItems)
        .innerJoin(items, eq(userItems.itemid, items.id))
        .where(eq(userItems.userid, userid))
})
