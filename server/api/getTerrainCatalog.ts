import { db } from '../utils/db'
import { items } from '../db/schema'
import { eq } from 'drizzle-orm'

// getMapItemCatalog.ts와 같은 이유로 존재 — 관리자가 등록한 지형(category='terrain')의 실제
// 타일 이미지를 useIsoMap.ts(useTerrainCatalog.ts)가 가져다 쓰기 위한 조회용 엔드포인트.
// terrain은 map_item처럼 레이어 합성이 필요 없어서 icon 필드 자체가 곧 렌더링에 쓰는 실제 타일
// 이미지 URL임(WindowSettings.vue에서 오브젝트 스토리지로 업로드한 URL이 그대로 들어감).
// active 여부와 무관하게 전부 내려줌 — 상점 진열만 active로 가리고, 이미 맵에 깔린 타일은
// 상점에서 내려도 계속 렌더링돼야 함.
export default eventHandler(async () => {
    const rows = await db.select().from(items).where(eq(items.category, 'terrain'))

    return rows.flatMap((row) => {
        const id = Number(row.itemKey)
        if (!Number.isFinite(id) || !row.icon) return []
        return [{ id, name: row.name, image: row.icon, blocksMovement: row.blocksMovement }]
    })
})
