import { db } from '../utils/db'
import { items, userItems } from '../db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

// 본인 인벤토리 전용 — 다른 유저 인벤토리는 조회 API 자체가 없음(아직 남에게 보여줄 이유가 없어서)
export default eventHandler(async (event) => {
    const userid = await requireUserId(event)
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
        // harvestCrop.ts처럼 소모형(기능/작물 씨앗 등) 아이템은 다 쓰면 count가 0으로 깎일 뿐
        // 행 자체는 안 지워짐 — 여기서 걸러주지 않으면 다 쓴 아이템이 "1개 보유" 문구도 없이
        // 인벤토리에 계속 남아있는 것처럼 보임
        .where(and(eq(userItems.userid, userid), gt(userItems.count, 0)))
})
