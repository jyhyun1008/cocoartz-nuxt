import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { partString, uploadMapItemLayers } from '../../utils/shopItemAssets'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// 맵 아이템 레이어 1~6장을 업로드하고, 실제 렌더링과 동일한 비율로 합성한 미리보기 아이콘까지
// 만들어서 { layers, icon } 으로 돌려줌 — createShopItem/updateShopItem은 이 결과를 그대로 받아서 저장만 함
export default eventHandler(async (event) => {
    const parts = await readMultipartFormData(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    return await uploadMapItemLayers(parts)
})
