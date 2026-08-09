import { db } from '../utils/db'
import { items, userItems } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getOptionalUserId } from '../utils/session'

// 상점 목록 — 로그인 없이도 구경은 가능해서 userid는 optional. userid가 있으면 각 아이템을
// 몇 개(0/1) 갖고 있는지 owned로 같이 내려줘서 WindowShop.vue가 "보유중" 표시/재구매 방지에 씀
export default eventHandler(async (event) => {
    const userid = await getOptionalUserId(event)

    const catalog = await db.select().from(items).where(eq(items.active, true))

    if (!userid) return catalog.map(item => ({ ...item, owned: 0 }))

    const owned = await db.select({ itemid: userItems.itemid, count: userItems.count })
        .from(userItems).where(eq(userItems.userid, userid))
    const ownedMap = new Map(owned.map(o => [o.itemid, o.count]))

    return catalog.map(item => ({ ...item, owned: ownedMap.get(item.id) ?? 0 }))
})
