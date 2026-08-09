import { db } from '../../utils/db'
import { users, items } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// 이미 산 사람의 인벤토리(user_items)나 맵에 놓인 아이템은 그대로 두고 카탈로그 행만 지움 —
// deleteCustomEmoji.ts와 같은 방식(참조가 남아도 조용히 폴백됨: 인벤토리는 이름만 보존된 값을
// 캐시해서 안 쓰니 카드가 사라지고, 맵 아이템은 getItemLayers가 빈 배열을 돌려줘서 그냥 안 그려짐).
// 상점에서만 안 보이게 하고 기존 참조는 살리고 싶으면 삭제 대신 active=false로 끄는 걸 권장
export default eventHandler(async (event) => {
    const { id } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)
    if (!id) throw createError({ statusCode: 400, message: 'id가 필요합니다' })

    await db.delete(items).where(eq(items.id, id))
    return { success: true }
})
