import { db } from '../utils/db'
import { users, items, userItems } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '../utils/session'
import { broadcastUserUpdate } from '../routes/_ws'

// users.character(JSON, useCharacter.ts DEFAULT_CHARACTER 형식)의 해당 파트 슬롯만 갈아끼움 —
// 새 필드/테이블 없이 이미 있던 "지금 장착 중" 저장소를 그대로 씀. 가입 시 기본 파츠(variant 1)를
// 전원이 이미 보유 상태로 지급받아뒀어서(server/db/seedShopItems.ts), 인벤토리에 뜨는 아바타
// 아이템은 항상 "보유한 것 = 장착 가능한 것"이라 별도 초기 이행 처리가 필요 없음.
export default eventHandler(async (event) => {
    const { category, itemKey } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!category?.startsWith('avatar_')) throw createError({ statusCode: 400, message: '아바타 카테고리가 아닙니다' })
    const part = category.slice('avatar_'.length)

    const [item] = await db.select({ id: items.id }).from(items)
        .where(and(eq(items.category, category), eq(items.itemKey, String(itemKey))))
    if (!item) throw createError({ statusCode: 404, message: '존재하지 않는 아이템입니다' })

    const [owned] = await db.select({ count: userItems.count }).from(userItems)
        .where(and(eq(userItems.userid, userid), eq(userItems.itemid, item.id)))
    if (!owned || owned.count <= 0) throw createError({ statusCode: 403, message: '보유하지 않은 아이템은 장착할 수 없어요' })

    const [user] = await db.select({ character: users.character }).from(users).where(eq(users.id, userid))
    let config: Record<string, unknown> = {}
    try { config = user?.character ? JSON.parse(user.character) : {} } catch { config = {} }
    config[part] = Number(itemKey)

    // outfit(한벌옷)은 bottom+top을 대신하는 상호 배타 슬롯 — useCharacter.ts의 getCharacterLayers가
    // 렌더링 시점에 outfit 있으면 bottom/top을 무시하긴 하지만, 저장된 값 자체도 서로 지워줘야
    // (1) outfit을 벗었을 때 예전에 입고 있던 것과 무관한 엉뚱한 상하의가 부활하지 않고,
    // (2) 인벤토리 화면에서 "지금 장착 중"인 아이템 표시(isEquipped)가 실제 보이는 모습과 맞음
    if (part === 'outfit') {
        delete config.bottom
        delete config.top
    } else if (part === 'bottom' || part === 'top') {
        delete config.outfit
    }

    const [updatedUser] = await db.update(users).set({ character: JSON.stringify(config) })
        .where(eq(users.id, userid))
        .returning()

    // 마을에 있는 채로 옷을 갈아입고 돌아온 경우에도 같은 방에 있던 다른 유저들 화면에 즉시
    // 반영되도록(server/routes/_ws.ts의 broadcastUserUpdate 참고)
    broadcastUserUpdate(userid, updatedUser)

    return { ok: true, character: config }
})
