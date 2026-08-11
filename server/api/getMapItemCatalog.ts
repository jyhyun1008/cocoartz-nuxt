import { db } from '../utils/db'
import { items } from '../db/schema'
import { inArray } from 'drizzle-orm'

// 관리자 페이지에서 등록한 맵 아이템(6장 레이어)을 useItemCatalog.ts의 하드코딩 카탈로그와 합쳐
// 쓰기 위한 조회용 엔드포인트. active 여부와 무관하게 전부 내려줌 — 상점 진열만 active로 가리고,
// 이미 맵에 배치됐거나 인벤토리에 있는 아이템은 비활성화돼도 계속 렌더링돼야 하기 때문
// (WindowSettings.vue에서 상점 진열을 껐다고 이미 놓인 맵 아이템이 사라지면 안 됨).
//
// category='functional'도 같이 내려줌 — 농사 작물(밀 등)이 여기 속함. 기능 아이템 전부가 맵에
// 놓이는 건 아니라서(예: 미래의 순수 소모품) meta.layers가 있는 것만 걸러 씀 — map_item과 완전히
// 같은 6장 스프라이트 스태킹 규칙. growSeconds가 있으면 "작물"로 보고 성장 계산(useItemCatalog.ts
// getCropGrowth 참고)에 바로 쓸 수 있게 crop 필드로 같이 내려보냄.
export default eventHandler(async () => {
    const rows = await db.select().from(items).where(inArray(items.category, ['map_item', 'functional']))

    return rows.flatMap((row) => {
        const id = Number(row.itemKey)
        if (!Number.isFinite(id)) return []
        let meta: any = null
        try { meta = row.meta ? JSON.parse(row.meta) : null } catch { meta = null }
        if (!Array.isArray(meta?.layers) || !meta.layers.length) return []

        const growSeconds = Number(meta.growSeconds)
        const crop = row.category === 'functional' && Number.isFinite(growSeconds) && growSeconds > 0
            ? {
                growSeconds,
                rewardMin: Number.isFinite(Number(meta.rewardMin)) ? Number(meta.rewardMin) : 20,
                rewardMax: Number.isFinite(Number(meta.rewardMax)) ? Number(meta.rewardMax) : 30,
            }
            : undefined

        return [{
            id,
            name: row.name,
            layers: meta.layers as string[],
            flipBackOffsets: Array.isArray(meta.flipBackOffsets) ? meta.flipBackOffsets as number[] : undefined,
            crop,
            behindAvatar: meta.behindAvatar === true,
        }]
    })
})
