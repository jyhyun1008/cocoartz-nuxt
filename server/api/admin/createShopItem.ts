import { db } from '../../utils/db'
import { users, items } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { isValidCategory } from '../../../lib/shopCategories'
import { requireUserId } from '../../utils/session'
import { compositeIconFromLayerUrls } from '../../utils/shopItemAssets'
import { uploadImage } from '../../utils/objectStorage'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// itemKey는 카테고리 상관없이 전부 자동 배정(등록 후 DB가 발급한 자기 id를 그대로 문자열로 씀) —
// 예전엔 아바타/지형/기능/소모품은 관리자가 직접 번호·문자열을 입력해야 했고 겹치면 등록이 막혔는데,
// 어차피 유저에게 노출되는 값이 아니라서(상점엔 name/description만 보임) 전부 자동으로 통일함.
// 유일한 예외는 없음 — 아바타의 "관례 경로"(icon 업로드 없이 /character/{파츠}/{itemKey}.png를
// 그대로 쓰는 폴백)도 이제 자동 배정된 id를 그 경로에 미리 맞춰 배포해두는 식으로 여전히 쓸 수 있음.
//
// icon/layers는 문자열/URL만 받음 — 실제 파일 업로드는 uploadShopIcon.ts / uploadMapItemLayer.ts를
// 먼저 호출해서(관리자 페이지가 파일 선택 즉시 호출) 그 결과 URL을 여기로 넘겨받는 구조
export default eventHandler(async (event) => {
    const body = await readBody(event)
    const { category, name, description, price, active, icon, isDefault, blocksMovement, decoLayer, isCrop, behindAvatar } = body
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

    // 맵에 6장 레이어로 배치되는 아이템 — map_item(순수 장식) 또는 functional+isCrop(농사 작물)일 때
    const isMapPlaceable = category === 'map_item' || (category === 'functional' && isCrop === true)
    if (isMapPlaceable) {
        const layers = body.layers
        if (!Array.isArray(layers) || layers.length !== 6 || layers.some((l) => typeof l !== 'string' || !l)) {
            throw createError({ statusCode: 400, message: '레이어 이미지 6장이 필요합니다(1~6번 칸을 모두 채워주세요)' })
        }

        // 바닥에 까는 아이템(러그 등) — 켜두면 MapItem.vue가 캐릭터보다 항상 뒤에 그려지도록 z-index를 누름
        const finalBehindAvatar = behindAvatar === true

        // 상점/인벤토리에 보일 아이콘은 항상 서버가 6장을 실제 스태킹 비율로 합성해서 만듦
        // (관리자가 올리는 건 순수 레이어 원본일 뿐, 합성 결과를 따로 안 올려도 됨)
        const iconBuffer = await compositeIconFromLayerUrls(layers)
        const compositedIcon = await uploadImage(iconBuffer, 'image/png', 'map-items')

        // 작물 전용 성장 설정 — growSeconds(초)는 필수, 보상 범위는 안 주면 기본 20~30
        let meta: Record<string, unknown> = { layers, behindAvatar: finalBehindAvatar }
        if (category === 'functional') {
            const growSeconds = Math.max(1, Math.floor(Number(body.growSeconds) || 0))
            if (!growSeconds) throw createError({ statusCode: 400, message: '작물의 성장 시간(초)을 입력해주세요' })
            const rewardMin = Math.max(0, Math.floor(Number(body.rewardMin) || 0)) || 20
            const rewardMax = Math.max(rewardMin, Math.floor(Number(body.rewardMax) || 0) || 30)
            meta = { layers, growSeconds, rewardMin, rewardMax, behindAvatar: finalBehindAvatar }
        }

        // 유니크 인덱스 충돌 방지용 임시값을 먼저 넣고, 발급된 id로 itemKey를 확정함
        const [created] = await db.insert(items).values({
            category, itemKey: `tmp-${createId()}`, name: trimmedName, description: finalDescription,
            icon: compositedIcon, price: finalPrice, active: finalActive, isDefault: finalIsDefault, meta: JSON.stringify(meta),
        }).returning()

        const [final] = await db.update(items)
            .set({ itemKey: String(created.id) })
            .where(eq(items.id, created.id))
            .returning()
        return final
    }

    // 나머지 카테고리(아바타/지형/맵 배경/일반 기능 아이템/소모품)도 map_item과 같은 패턴으로
    // itemKey를 자동 배정 — 임시값을 넣고 발급된 id로 확정함
    const [created] = await db.insert(items).values({
        category, itemKey: `tmp-${createId()}`, name: trimmedName, description: finalDescription, icon: icon || null,
        price: finalPrice, active: finalActive, isDefault: finalIsDefault, blocksMovement: finalBlocksMovement,
        meta: finalMeta,
    }).returning()

    const [final] = await db.update(items)
        .set({ itemKey: String(created.id) })
        .where(eq(items.id, created.id))
        .returning()
    return final
})
