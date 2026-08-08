// 지형 타일(terrain) 카탈로그 — useItemCatalog.ts(맵 아이템)와 완전히 같은 패턴.
// 예전엔 useIsoMap.ts의 getFilePath가 `/tileset/${itemid}.png`로 고정돼있어서, 실제로 화면에
// 그려지는 타일 그림을 서버 관리자 페이지에서 업로드로 못 바꾸고(아이콘만 따로 있고 정작 렌더링은
// 파일시스템에 미리 박아둔 파일만 썼음) 항상 배포할 때 파일을 직접 넣어야 했음. 이제 관리자 페이지에서
// 지형 아이템을 등록/수정하면서 올린 이미지(items.icon)가 그대로 렌더링에도 쓰이도록 이 카탈로그를 거침.
export interface TerrainDef {
    id: number
    name: string
    image: string
}

// server/db/seedShopItems.ts의 STARTER_TERRAIN_ITEMS(1~5)와 짝맞춘 기본값 — DB 조회가 아직 안 끝났거나
// (SSR 중) seed가 안 돌아간 상태에서도 기본 지형 5종은 항상 그려지도록 하는 안전망
const STATIC_TERRAIN_CATALOG: TerrainDef[] = [1, 2, 3, 4, 5].map(n => ({ id: n, name: `지형 ${n}`, image: `/tileset/${n}.png` }))

export function useTerrainCatalog() {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl

    const { data: dbCatalogData } = useAsyncData(
        'db-terrain-catalog',
        () => $fetch<TerrainDef[]>(`${apiBaseUrl}/api/getTerrainCatalog`).catch(() => []),
        { server: false },
    )

    const TERRAIN_CATALOG = computed<TerrainDef[]>(() => {
        const dbItems = dbCatalogData.value ?? []
        const dbIds = new Set(dbItems.map(i => i.id))
        return [...STATIC_TERRAIN_CATALOG.filter(i => !dbIds.has(i.id)), ...dbItems]
    })

    function getTerrainImage(id: number): string {
        return TERRAIN_CATALOG.value.find(t => t.id === id)?.image ?? `/tileset/${id}.png`
    }

    return { TERRAIN_CATALOG, getTerrainImage }
}
