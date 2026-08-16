import { db } from '../../utils/db'
import { items } from '../../db/schema'
import { requirePermission } from '../../utils/permissions'

// 상점 진열용 getShopCatalog.ts와 달리 active=false인 것까지 전부 내려줌(관리용 전체 목록)
export default eventHandler(async (event) => {
    await requirePermission(event, 'accessAdminSettings')

    return await db.select().from(items).orderBy(items.category, items.id)
})
