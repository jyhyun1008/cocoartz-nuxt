import { db } from '../utils/db'
import { items } from '../db/schema'
import { eq } from 'drizzle-orm'

// getTerrainCatalog.ts와 같은 이유로 존재 — 관리자/유저가 등록·구매한 맵 배경(category=
// 'map_background')의 실제 이미지를 useMapBackgroundCatalog.ts가 가져다 쓰기 위한 조회용
// 엔드포인트. terrain과 마찬가지로 레이어 합성이 필요 없어서 icon 필드가 곧 실제로 맵 전체에
// 깔리는 배경 이미지 URL임. active 여부와 무관하게 전부 내려줌 — 상점 진열만 active로 가리고,
// 이미 어떤 방에 적용된 배경은 상점에서 내려도 계속 렌더링돼야 함.
export default eventHandler(async () => {
    const rows = await db.select().from(items).where(eq(items.category, 'map_background'))

    return rows.flatMap((row) => {
        if (!row.icon) return []
        // isDefault(가입 시 기본 지급 여부)도 같이 내려줌 — useMapBackgroundCatalog.ts가 이 값으로
        // "아무것도 안 고른 맵의 기본 배경"을 찾음(관리자가 오브젝트 스토리지에 올린 이미지를
        // map_background 아이템으로 등록하고 isDefault 체크만 켜두면 그게 그대로 기본 배경이 됨)
        return [{ itemKey: row.itemKey, name: row.name, image: row.icon, isDefault: row.isDefault }]
    })
})
