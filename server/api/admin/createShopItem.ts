import { db } from '../../utils/db'
import { users, items } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { isValidCategory } from '../../../lib/shopCategories'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// icon/layers는 문자열/URL만 받음 — 실제 파일 업로드는 uploadShopIcon.ts / uploadMapItemLayers.ts를
// 먼저 호출해서(관리자 페이지가 파일 선택 즉시 호출) 그 결과 URL을 여기로 넘겨받는 구조
export default eventHandler(async (event) => {
    const body = await readBody(event)
    const { userid, category, name, description, price, active, icon } = body
    await checkAdmin(userid)

    if (!isValidCategory(category)) throw createError({ statusCode: 400, message: '올바르지 않은 카테고리입니다' })

    const trimmedName = String(name ?? '').trim()
    if (!trimmedName) throw createError({ statusCode: 400, message: '이름을 입력해주세요' })

    const finalDescription = String(description ?? '').trim() || null
    const finalPrice = Math.max(0, Math.floor(Number(price) || 0))
    const finalActive = active !== false

    if (category === 'map_item') {
        const layers = body.layers
        if (!Array.isArray(layers) || layers.length !== 6 || layers.some((l) => typeof l !== 'string' || !l)) {
            throw createError({ statusCode: 400, message: '레이어 이미지 6장이 필요합니다(uploadMapItemLayers 먼저 호출)' })
        }

        // itemKey는 손으로 못 정함 — DB가 발급한 자기 id를 그대로 문자열로 씀(레거시 하드코딩
        // 카탈로그의 1·2와 절대 안 겹치게 하기 위함). 유니크 인덱스 충돌 방지용 임시값을 먼저 넣음
        const [created] = await db.insert(items).values({
            category, itemKey: `tmp-${createId()}`, name: trimmedName, description: finalDescription,
            icon: icon || null, price: finalPrice, active: finalActive, meta: JSON.stringify({ layers }),
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
        category, itemKey, name: trimmedName, description: finalDescription, icon: icon || null, price: finalPrice, active: finalActive,
    }).returning()
    return created
})
