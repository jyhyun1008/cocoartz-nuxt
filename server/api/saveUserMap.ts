import { db } from '../utils/db'
import { users, items, userItems } from '../db/schema'
import { eq, and } from 'drizzle-orm'

// 맵 아이템(mapInfo[1])은 상점에서 산 만큼만 놓을 수 있음 — WindowMapEditor.vue가 팔레트에서도
// 막지만, 이 API를 직접 호출해서 우회하는 걸 막기 위해 저장 시점에 서버에서도 한 번 더 셈.
// 타일(mapInfo[0])은 아직 상점 연동이 없어서(특수지형 미구현) 검증 대상이 아님.
async function validateMapItems(userid: number, mapJson: string) {
    let parsed: any
    try { parsed = JSON.parse(mapJson) } catch { return }
    const placedItems = Array.isArray(parsed?.[1]) ? parsed[1] : []
    if (!placedItems.length) return

    const placedCounts = new Map<number, number>()
    for (const it of placedItems) {
        const id = it?.itemid
        if (typeof id !== 'number') continue
        placedCounts.set(id, (placedCounts.get(id) ?? 0) + 1)
    }

    for (const [itemid, placedCount] of placedCounts) {
        const [item] = await db.select({ id: items.id }).from(items)
            .where(and(eq(items.category, 'map_item'), eq(items.itemKey, String(itemid))))
        if (!item) throw createError({ statusCode: 400, message: `등록되지 않은 아이템(${itemid})은 놓을 수 없어요` })

        const [owned] = await db.select({ count: userItems.count }).from(userItems)
            .where(and(eq(userItems.userid, userid), eq(userItems.itemid, item.id)))
        const ownedCount = owned?.count ?? 0
        if (placedCount > ownedCount) {
            throw createError({
                statusCode: 400,
                message: `보유한 개수보다 많이 놓을 수 없어요(아이템 ${itemid}: 보유 ${ownedCount}개, 배치 ${placedCount}개)`,
            })
        }
    }
}

export default eventHandler(async (event) => {
    const { userid, map } = await readBody(event)
    if (!userid) throw createError({ statusCode: 400, message: '로그인이 필요합니다' })

    await validateMapItems(Number(userid), map)

    await db.update(users).set({ map }).where(eq(users.id, Number(userid)))
    return { ok: true }
})
