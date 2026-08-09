import { db } from '../utils/db'
import { users, items, userItems } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

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

    await db.update(users).set({ character: JSON.stringify(config) }).where(eq(users.id, userid))
    return { ok: true, character: config }
})
