import { db } from '../utils/db'
import { items, userItems, currencyBalances } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { isStackableCategory } from '../../lib/shopCategories'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { serverid, itemid, quantity } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!serverid || !itemid) throw createError({ statusCode: 400, message: 'serverid, itemid가 필요합니다' })

    const [item] = await db.select().from(items).where(and(eq(items.id, itemid), eq(items.active, true)))
    if (!item) throw createError({ statusCode: 404, message: '판매 중이 아닌 아이템입니다' })

    // 아바타 파츠/지형만 "있다/없다"라 이미 보유 중이면 중복 구매를 막음(잘못 두 번 눌러서 코코아만
    // 날리는 걸 방지) — 맵 아이템/기능 아이템/소모품은 여러 개 살 수 있음
    const stackable = isStackableCategory(item.category)
    const qty = stackable ? Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1))) : 1

    if (!stackable) {
        const [existing] = await db.select().from(userItems)
            .where(and(eq(userItems.userid, userid), eq(userItems.itemid, itemid)))
        if (existing) throw createError({ statusCode: 400, message: '이미 보유한 아이템입니다' })
    }

    const totalPrice = item.price * qty

    return await db.transaction(async (tx) => {
        // WHERE절에 "잔액이 충분할 때만" 조건을 같이 걸어서, 동시에 여러 번 구매 요청이 들어와도
        // 한 트랜잭션 안에서 원자적으로 처리됨(collectCoin.ts와 같은 방식) — 별도 select로 먼저
        // 잔액을 확인하고 나서 update하면 그 사이 다른 요청이 끼어드는 레이스가 생길 수 있음
        const [balanceRow] = await tx.update(currencyBalances)
            .set({ balance: sql`${currencyBalances.balance} - ${totalPrice}` })
            .where(and(
                eq(currencyBalances.userid, userid),
                eq(currencyBalances.serverid, serverid),
                sql`${currencyBalances.balance} >= ${totalPrice}`,
            ))
            .returning()

        if (!balanceRow) throw createError({ statusCode: 400, message: '잔액이 부족합니다' })

        await tx.insert(userItems)
            .values({ userid, itemid, count: qty })
            .onConflictDoUpdate({
                target: [userItems.userid, userItems.itemid],
                set: { count: sql`${userItems.count} + ${qty}`, updatedAt: new Date() },
            })

        return { ok: true, balance: balanceRow.balance }
    })
})
