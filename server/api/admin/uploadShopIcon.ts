import { partString, uploadSingleImage } from '../../utils/shopItemAssets'
import { requirePermission } from '../../utils/permissions'

// 상점 아이템 아이콘 하나(아바타/지형/기능/소모품) 업로드 — createShopItem/updateShopItem은
// 이 결과 URL을 문자열로만 받음(uploadAvatar.ts와 동일한 분리 방식)
export default eventHandler(async (event) => {
    const parts = await readMultipartFormData(event)
    await requirePermission(event, 'accessAdminSettings')

    const url = await uploadSingleImage(parts, 'file', 'shop-items')
    return { url }
})
