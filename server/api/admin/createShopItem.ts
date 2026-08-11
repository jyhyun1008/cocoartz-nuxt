import { db } from '../../utils/db'
import { users, items } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { isValidCategory } from '../../../lib/shopCategories'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// icon/layers는 문자열/URL만 받음 — 실제 파일 업로드는 uploadShopIcon.ts / uploadMapItemLayers.ts를
// 먼저 호출해서(관리자 페이지가 파일 선택 즉시 호출) 그 결과 URL을 여기로 넘겨받는 구조
export default eventHandler(async (event) => {
    const body = await readBody(event)
    const { category, name, description, price, active, icon, isDefault, blocksMovement, decoLayer, isCrop } = body
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    if (!isValidCategory(category)) throw createError({ statusCode: 400, message: '올바르지 않은 카테고리입니다' })

    const trimmedName = String(name ?? '').trim()
    if (!trimmedName) throw createError({ statusCode: 400, message: '이름을 입력해주세요' })

    const finalDescription = String(description ?? '').trim() || null
    const finalPrice = Math.max(0, Math.floor(Number(price) || 0))
    const finalActive = active !== false
    // 가입 시 자동 지급 여부 — server/api/auth/register.ts가 이 플래그를 보고 신규 유저에게 지급함
    const finalIsDefault = isDefault === true
    // 지형 전용 — 캐릭터가 못 지나감(예: 물). 다른 카테고리는 의미 없는 값이라 무조건 false로 고정
    const finalBlocksMovement = category === 'terrain' && blocksMovement === true
    // 데코 전용 — 몸 앞/뒤 어느 레이어에 그릴지. items.meta에 저장(map_item의 layers와 같은 자리 재사용)
    const finalMeta = category === 'avatar_deco' ? JSON.stringify({ layer: decoLayer === 'front' ? 'front' : 'back' }) : undefined

    // 맵에 6장 레이어로 배치되는 아이템 — map_item(순수 장식) 또는 functional+isCrop(농사 작물)일 때.
    // 둘 다 itemKey를 손으로 못 정하고 DB가 발급한 자기 id를 그대로 문자열로 씀(레거시 하드코딩
    // 카탈로그의 1·2와 절대 안 겹치게 하기 위함) — createShopItem 호출 한 번으로 등록·id 확정까지 끝남.
    const isMapPlaceable = category === 'map_item' || (category === 'functional' && isCrop === true)
    if (isMapPlaceable) {
        const layers = body.layers
        if (!Array.isArray(layers) || layers.length !== 6 || layers.some((l) => typeof l !== 'string' || !l)) {
            throw createError({ statusCode: 400, message: '레이어 이미지 6장이 필요합니다(uploadMapItemLayers 먼저 호출)' })
        }

        // 작물 전용 성장 설정 — growSeconds(초)는 필수, 보상 범위는 안 주면 기본 20~30
        let meta: Record<string, unknown> = { layers }
        if (category === 'functional') {
            const growSeconds = Math.max(1, Math.floor(Number(body.growSeconds) || 0))
            if (!growSeconds) throw createError({ statusCode: 400, message: '작물의 성장 시간(초)을 입력해주세요' })
            const rewardMin = Math.max(0, Math.floor(Number(body.rewardMin) || 0)) || 20
            const rewardMax = Math.max(rewardMin, Math.floor(Number(body.rewardMax) || 0) || 30)
            meta = { layers, growSeconds, rewardMin, rewardMax }
        }

        // 유니크 인덱스 충돌 방지용 임시값을 먼저 넣고, 발급된 id로 itemKey를 확정함
        const [created] = await db.insert(items).values({
            category, itemKey: `tmp-${createId()}`, name: trimmedName, description: finalDescription,
            icon: icon || null, price: finalPrice, active: finalActive, isDefault: finalIsDefault, meta: JSON.stringify(meta),
        }).returning()

        const [final] = await db.update(items)
            .set({ itemKey: String(created.id) })
            .where(eq(items.id, created.id))
            .returning()
        return final
    }

    const itemKey = String(body.itemKey ?? '').trim()
    if (!itemKey) throw createError({ statusCode: 400, message: 'itemKey를 입력해주세요' })

    const [existing] = await db.select().from(items).where(and(eq(items.category, category), eq(items.itemKey, itemKey)))
    if (existing) throw createError({ statusCode: 400, message: '이미 등록된 category/itemKey 조합입니다' })

    const [created] = await db.insert(items).values({
        category, itemKey, name: trimmedName, description: finalDescription, icon: icon || null,
        price: finalPrice, active: finalActive, isDefault: finalIsDefault, blocksMovement: finalBlocksMovement,
        meta: finalMeta,
    }).returning()
    return created
})
