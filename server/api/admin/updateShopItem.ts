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
    const { id, name, description, price, active, icon, layers, isDefault, blocksMovement } = body
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

    if (existing.category === 'map_item') {
        // 6장을 통째로 새로 올렸을 때만(부분 교체 불가) 갈아끼움 — 안 왔으면 기존 그대로 둬서
        // 이미 맵에 놓인 아이템들이 갑자기 사라지지 않게 함
        if (Array.isArray(layers) && layers.length === 6) {
            patch.meta = JSON.stringify({ layers })
            if (icon) patch.icon = icon
        }
    } else if (icon !== undefined) {
        patch.icon = icon || null
    }

    const [updated] = await db.update(items).set(patch).where(eq(items.id, id)).returning()
    return updated
})
