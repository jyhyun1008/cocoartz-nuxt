import { db } from '../utils/db'
import { users, items, userItems } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

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

    // 놓인 아이템 종류마다 items/userItems를 따로 조회하던 걸(최대 2*N번) 배치 조회 2번으로 합침
    const itemKeys = [...placedCounts.keys()].map(String)
    const itemRows = await db.select({ id: items.id, itemKey: items.itemKey }).from(items)
        .where(and(eq(items.category, 'map_item'), inArray(items.itemKey, itemKeys)))
    const itemIdByKey = new Map(itemRows.map(r => [r.itemKey, r.id]))

    for (const itemid of placedCounts.keys()) {
        if (!itemIdByKey.has(String(itemid))) {
            throw createError({ statusCode: 400, message: `등록되지 않은 아이템(${itemid})은 놓을 수 없어요` })
        }
    }

    const ownedRows = await db.select({ itemid: userItems.itemid, count: userItems.count }).from(userItems)
        .where(and(eq(userItems.userid, userid), inArray(userItems.itemid, [...itemIdByKey.values()])))
    const ownedByItemId = new Map(ownedRows.map(r => [r.itemid, r.count]))

    for (const [itemid, placedCount] of placedCounts) {
        const dbItemId = itemIdByKey.get(String(itemid))!
        const ownedCount = ownedByItemId.get(dbItemId) ?? 0
        if (placedCount > ownedCount) {
            throw createError({
                statusCode: 400,
                message: `보유한 개수보다 많이 놓을 수 없어요(아이템 ${itemid}: 보유 ${ownedCount}개, 배치 ${placedCount}개)`,
            })
        }
    }
}

export default eventHandler(async (event) => {
    const { map } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 400, message: '로그인이 필요합니다' })

    await validateMapItems(Number(userid), map)

    await db.update(users).set({ map }).where(eq(users.id, Number(userid)))
    return { ok: true }
})
