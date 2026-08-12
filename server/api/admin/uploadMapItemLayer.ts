import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { uploadSingleMapItemLayer } from '../../utils/shopItemAssets'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// 맵 아이템/작물의 레이어 칸 하나(1~6번 중 하나)만 업로드 — createShopItem/updateShopItem이
// 6개 칸이 최종적으로 다 채워진 뒤에(이번에 새로 올린 것 + 기존 값) 아이콘을 합성해서 저장함
export default eventHandler(async (event) => {
    const parts = await readMultipartFormData(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    const url = await uploadSingleMapItemLayer(parts)
    return { url }
})
