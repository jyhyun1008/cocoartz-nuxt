import { uploadSingleMapItemLayer } from '../../utils/shopItemAssets'
import { requirePermission } from '../../utils/permissions'

// 맵 아이템/작물의 레이어 칸 하나(1~6번 중 하나)만 업로드 — createShopItem/updateShopItem이
// 6개 칸이 최종적으로 다 채워진 뒤에(이번에 새로 올린 것 + 기존 값) 아이콘을 합성해서 저장함
export default eventHandler(async (event) => {
    const parts = await readMultipartFormData(event)
    await requirePermission(event, 'accessAdminSettings')

    const url = await uploadSingleMapItemLayer(parts)
    return { url }
})
