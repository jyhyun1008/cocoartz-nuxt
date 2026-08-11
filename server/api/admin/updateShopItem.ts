import { db } from '../../utils/db'
import { users, items } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// category/itemKey는 여기서 못 바꿈 — 이미 인벤토리·캐릭터·맵에 그 값으로 참조가 걸려있어서
// 바꾸면 기존 보유자/배치가 다 깨짐. 다른 카테고리/키로 옮기고 싶으면 새로 등록하고 이건 지울 것.
// icon/layers도 uploadShopIcon.ts / uploadMapItemLayers.ts로 먼저 업로드한 URL만 받음(createShopItem.ts와 동일)
export default eventHandler(async (event) => {
    const body = await readBody(event)
    const { id, name, description, price, active, icon, layers, isDefault, blocksMovement, decoLayer, growSeconds, rewardMin, rewardMax } = body
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    if (!id) throw createError({ statusCode: 400, message: 'id가 필요합니다' })
    const [existing] = await db.select().from(items).where(eq(items.id, id))
    if (!existing) throw createError({ statusCode: 404, message: '존재하지 않는 아이템입니다' })

    const trimmedName = String(name ?? '').trim()
    if (!trimmedName) throw createError({ statusCode: 400, message: '이름을 입력해주세요' })

    const patch: Record<string, unknown> = {
        name: trimmedName,
        description: String(description ?? '').trim() || null,
        price: Math.max(0, Math.floor(Number(price) || 0)),
        active: active !== false,
        isDefault: isDefault === true,
    }
    // 지형 전용 — 다른 카테고리는 무조건 false로 고정(생성 시점과 동일한 규칙)
    if (existing.category === 'terrain') {
        patch.blocksMovement = blocksMovement === true
    }
    // 데코 전용 — 몸 앞/뒤 어느 레이어에 그릴지(생성 시점과 동일한 규칙)
    if (existing.category === 'avatar_deco') {
        patch.meta = JSON.stringify({ layer: decoLayer === 'front' ? 'front' : 'back' })
    }

    // 기존 meta에 layers가 있었으면(map_item, 또는 functional로 등록된 작물) 등록 당시 category가
    // 그대로 유지되니 그 값으로 "작물이었는지"를 판단함 — category 자체는 여기서 못 바꿈
    let existingMeta: any = null
    try { existingMeta = existing.meta ? JSON.parse(existing.meta) : null } catch { existingMeta = null }
    const wasMapPlaceable = existing.category === 'map_item' || (existing.category === 'functional' && Array.isArray(existingMeta?.layers))

    if (wasMapPlaceable) {
        // 6장을 통째로 새로 올렸을 때만(부분 교체 불가) 갈아끼움 — 안 왔으면 기존 레이어 그대로 둬서
        // 이미 맵에 놓인 아이템들이 갑자기 사라지지 않게 함
        const newLayers = Array.isArray(layers) && layers.length === 6 ? layers : existingMeta?.layers
        if (Array.isArray(layers) && layers.length === 6 && icon) patch.icon = icon

        if (existing.category === 'functional') {
            // 작물 성장 설정 — 안 보내면(값이 없으면) 기존 값 유지
            const finalGrowSeconds = growSeconds !== undefined
                ? Math.max(1, Math.floor(Number(growSeconds) || 0)) || existingMeta?.growSeconds
                : existingMeta?.growSeconds
            if (!finalGrowSeconds) throw createError({ statusCode: 400, message: '작물의 성장 시간(초)이 필요합니다' })
            const finalRewardMin = rewardMin !== undefined ? Math.max(0, Math.floor(Number(rewardMin) || 0)) : existingMeta?.rewardMin ?? 20
            const finalRewardMax = rewardMax !== undefined ? Math.max(finalRewardMin, Math.floor(Number(rewardMax) || 0)) : Math.max(finalRewardMin, existingMeta?.rewardMax ?? 30)
            patch.meta = JSON.stringify({ layers: newLayers, growSeconds: finalGrowSeconds, rewardMin: finalRewardMin, rewardMax: finalRewardMax })
        } else {
            patch.meta = JSON.stringify({ layers: newLayers })
        }
    } else if (icon !== undefined) {
        patch.icon = icon || null
    }

    const [updated] = await db.update(items).set(patch).where(eq(items.id, id)).returning()
    return updated
})
