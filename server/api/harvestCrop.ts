import { db } from '../utils/db'
import { users, items, userItems, currencyBalances } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

// 다 자란 작물을 수확함 — 본인 프로필 개인 홈 맵(users.map)에서만 동작함(다른 유저 것을 대신
// 수확할 방법 자체가 없음: 항상 세션 유저 자신의 map/인벤토리/재화만 건드림).
//
// 클라이언트(UserRoomEmbed.vue)는 "다 자랐다"고 로컬에서 판단해서 호출하지만, 그 판정은 절대
// 신뢰하지 않고 여기서 items.meta의 growSeconds + 서버에 저장된 plantedAt으로 다시 계산함(클라이언트
// 시계 조작/변조로 조기 수확하는 걸 막기 위함).
export default eventHandler(async (event) => {
    const { serverid, itemid, position, plantedAt } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!serverid) throw createError({ statusCode: 400, message: 'serverid가 필요합니다' })
    if (!itemid || typeof plantedAt !== 'number' || !position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        throw createError({ statusCode: 400, message: '작물 위치 정보가 올바르지 않습니다' })
    }
    const posZ = position.z ?? 0

    const [item] = await db.select().from(items).where(eq(items.id, itemid))
    if (!item || item.category !== 'functional') throw createError({ statusCode: 400, message: '수확할 수 없는 아이템입니다' })

    let meta: any = null
    try { meta = item.meta ? JSON.parse(item.meta) : null } catch { meta = null }
    const growSeconds = Number(meta?.growSeconds)
    if (!Number.isFinite(growSeconds) || growSeconds <= 0) throw createError({ statusCode: 400, message: '작물 정보가 없는 아이템입니다' })
    const rewardMin = Number.isFinite(Number(meta?.rewardMin)) ? Number(meta.rewardMin) : 20
    const rewardMax = Number.isFinite(Number(meta?.rewardMax)) ? Number(meta.rewardMax) : 30

    if (Date.now() - plantedAt < growSeconds * 1000) {
        throw createError({ statusCode: 400, message: '아직 다 자라지 않았어요' })
    }

    return await db.transaction(async (tx) => {
        // FOR UPDATE로 이 유저 행을 잠가서, 같은 작물을 동시에 두 번 수확 요청해도(연타 등)
        // 한쪽이 먼저 map을 지우고 커밋할 때까지 다른 쪽은 대기했다가 "이미 없음"으로 걸러짐
        const [user] = await tx.select({ map: users.map }).from(users).where(eq(users.id, userid)).for('update')
        let mapInfo: any = null
        try { mapInfo = user?.map ? JSON.parse(user.map) : null } catch { mapInfo = null }
        const mapItems = Array.isArray(mapInfo?.[1]) ? mapInfo[1] : []

        const idx = mapItems.findIndex((it: any) =>
            it.itemid === itemid && it.plantedAt === plantedAt &&
            it.position?.x === position.x && it.position?.y === position.y && (it.position?.z ?? 0) === posZ)
        if (idx === -1) throw createError({ statusCode: 400, message: '수확할 작물을 찾을 수 없어요(이미 수확했을 수 있어요)' })

        mapItems.splice(idx, 1)
        await tx.update(users).set({ map: JSON.stringify(mapInfo) }).where(eq(users.id, userid))

        // 보유 수량 1 차감 — 심을 때는 안 깎이고(놓을 수 있는 개수만 보유량으로 제한) 수확 시점에
        // 실제로 소모됨. count가 이미 0 이하면(정상 흐름에선 안 생기지만 방어적으로) 조건에 안 걸려
        // 아무 것도 안 바뀌므로 그 경우 balanceRow 없이 아래에서 걸러짐
        const [invRow] = await tx.update(userItems)
            .set({ count: sql`${userItems.count} - 1`, updatedAt: new Date() })
            .where(and(eq(userItems.userid, userid), eq(userItems.itemid, itemid), sql`${userItems.count} >= 1`))
            .returning()
        if (!invRow) throw createError({ statusCode: 400, message: '보유 수량이 없어요' })

        const amount = rewardMin + Math.floor(Math.random() * (rewardMax - rewardMin + 1))
        const [balanceRow] = await tx.insert(currencyBalances)
            .values({ userid, serverid, balance: amount })
            .onConflictDoUpdate({
                target: [currencyBalances.userid, currencyBalances.serverid],
                set: { balance: sql`${currencyBalances.balance} + ${amount}` },
            })
            .returning()

        return { ok: true, amount, balance: balanceRow.balance }
    })
})
