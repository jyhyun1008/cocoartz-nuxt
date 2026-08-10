import { db } from '../utils/db'
import { items } from '../db/schema'
import { inArray, and, isNotNull } from 'drizzle-orm'
import { AVATAR_CATEGORIES, avatarPartFromCategory, decoLayerOf } from '../../lib/shopCategories'

// getTerrainCatalog.ts와 같은 이유 — 관리자가 상점 페이지에서 캐릭터 파츠 원본 스프라이트시트를
// 직접 업로드한(items.icon) 아바타 아이템만 내려줌. icon이 없는(=가입 시 기본 지급되는 레거시
// 파츠처럼 /character/{part}/{variant}.png 파일이 이미 배포돼있는 경우) 아이템은 여기 안 실어도
// useAvatarPartCatalog.ts/AvatarPartIcon.vue가 알아서 그 관례 경로로 폴백함.
export default eventHandler(async () => {
    const rows = await db.select().from(items).where(and(inArray(items.category, AVATAR_CATEGORIES), isNotNull(items.icon)))

    return rows.flatMap((row) => {
        const part = avatarPartFromCategory(row.category)
        const variant = Number(row.itemKey)
        if (!part || !Number.isFinite(variant) || !row.icon) return []
        // 데코만 앞/뒤 레이어 정보가 의미 있음(items.meta에 저장 — WindowSettings.vue 등록 폼 참고)
        return [{ part, variant, image: row.icon, ...(part === 'deco' ? { layer: decoLayerOf(row.meta) } : {}) }]
    })
})
