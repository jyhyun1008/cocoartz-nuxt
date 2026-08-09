// 지형 타일(terrain) 카탈로그 — useItemCatalog.ts(맵 아이템)와 완전히 같은 패턴.
// 예전엔 useIsoMap.ts의 getFilePath가 `/tileset/${itemid}.png`로 고정돼있어서, 실제로 화면에
// 그려지는 타일 그림을 서버 관리자 페이지에서 업로드로 못 바꾸고(아이콘만 따로 있고 정작 렌더링은
// 파일시스템에 미리 박아둔 파일만 썼음) 항상 배포할 때 파일을 직접 넣어야 했음. 이제 관리자 페이지에서
// 지형 아이템을 등록/수정하면서 올린 이미지(items.icon)가 그대로 렌더링에도 쓰이도록 이 카탈로그를 거침.
export interface TerrainDef {
    id: number
    name: string
    image: string
    // 캐릭터가 이 지형 위로 못 지나감(예: 물) — 관리자가 상점 페이지에서 지형별로 지정.
    // RoomMap.vue/UserRoomEmbed.vue의 canEnterTile이 이 값을 씀(예전엔 itemid===2 하드코딩이었음)
    blocksMovement: boolean
}

// server/db/seedShopItems.ts의 STARTER_TERRAIN_ITEMS(1~5)와 짝맞춘 기본값 — DB 조회가 아직 안 끝났거나
// (SSR 중) seed가 안 돌아간 상태에서도 기본 지형 5종은 항상 그려지도록 하는 안전망. blocksMovement도
// 시드와 맞춰둠(2번=물만 true) — 예전 하드코딩(WATER_TILE_ID=2)과 같은 동작을 폴백으로도 유지
const STATIC_TERRAIN_CATALOG: TerrainDef[] = [1, 2, 3, 4, 5].map(n => ({
    id: n, name: `지형 ${n}`, image: `/tileset/${n}.png`, blocksMovement: n === 2,
}))

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

    // 카탈로그에 없는(예: 아직 등록 안 된) itemid는 안전하게 "막힘"으로 취급 — 지형이 없는 칸을
    // 그냥 지나갈 수 있게 두는 것보다, 모르는 지형은 막아두는 쪽이 덜 이상함
    function getTerrainBlocksMovement(id: number): boolean {
        return TERRAIN_CATALOG.value.find(t => t.id === id)?.blocksMovement ?? true
    }

    return { TERRAIN_CATALOG, getTerrainImage, getTerrainBlocksMovement }
}
