import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { partString, uploadSingleImage } from '../../utils/shopItemAssets'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// 상점 아이템 아이콘 하나(아바타/지형/기능/소모품) 업로드 — createShopItem/updateShopItem은
// 이 결과 URL을 문자열로만 받음(uploadAvatar.ts와 동일한 분리 방식)
export default eventHandler(async (event) => {
    const parts = await readMultipartFormData(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    const url = await uploadSingleImage(parts, 'file', 'shop-items')
    return { url }
})
