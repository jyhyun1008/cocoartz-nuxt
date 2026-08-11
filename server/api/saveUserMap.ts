import { db } from '../utils/db'
import { users, items, userItems } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

// 작물은 종류 상관없이 맵 하나에 최대 이 개수까지만 심을 수 있음 — WindowMapEditor.vue와 같은 값
// (값을 바꾸면 두 군데 다 맞출 것). 여기서 막아야 그 화면을 거치지 않고 API를 직접 불러 우회하는
// 것도 같이 막힘
const MAX_CROPS_PER_MAP = 4

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

    // 놓인 아이템 종류마다 items/userItems를 따로 조회하던 걸(최대 2*N번) 배치 조회 2번으로 합침.
    // map_item(장식) + functional(농사 작물 등, getMapItemCatalog.ts와 동일하게 취급) 둘 다 대상.
    // meta도 같이 가져와서 "작물인지"(growSeconds 유무)까지 여기서 바로 판단함
    const itemKeys = [...placedCounts.keys()].map(String)
    const itemRows = await db.select({ id: items.id, itemKey: items.itemKey, category: items.category, meta: items.meta }).from(items)
        .where(and(inArray(items.category, ['map_item', 'functional']), inArray(items.itemKey, itemKeys)))
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

    let totalCrops = 0
    for (const row of itemRows) {
        if (row.category !== 'functional') continue
        let meta: any = null
        try { meta = row.meta ? JSON.parse(row.meta) : null } catch { meta = null }
        if (!(Number(meta?.growSeconds) > 0)) continue
        totalCrops += placedCounts.get(Number(row.itemKey)) ?? 0
    }
    if (totalCrops > MAX_CROPS_PER_MAP) {
        throw createError({ statusCode: 400, message: `작물은 맵 하나에 최대 ${MAX_CROPS_PER_MAP}개까지만 심을 수 있어요(지금 ${totalCrops}개)` })
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
