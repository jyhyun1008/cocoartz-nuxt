// 맵 배경(map_background) 카탈로그 — useTerrainCatalog.ts와 완전히 같은 패턴. 맵 JSON의 4번째
// 요소([tiles, items, spawn, background])에 저장된 배경 아이템의 itemKey를 실제 이미지 URL로
// 풀어주는 역할만 함. 배경을 아예 고른 적 없거나(itemKey가 null), 고른 배경이 목록에 없으면(예:
// 관리자가 삭제) public/mapbg.png를 기본값으로 씀 — 그래서 이 기능이 생기기 전부터 있던 모든 맵도
// 별도 마이그레이션 없이 자동으로 이 기본 배경을 갖게 됨.
const DEFAULT_BACKGROUND_IMAGE = '/mapbg.png'

export interface MapBackgroundDef {
    itemKey: string
    name: string
    image: string
}

export function useMapBackgroundCatalog() {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl

    const { data: dbCatalogData } = useAsyncData(
        'db-map-background-catalog',
        () => $fetch<MapBackgroundDef[]>(`${apiBaseUrl}/api/getMapBackgroundCatalog`).catch(() => []),
        { server: false },
    )

    const MAP_BACKGROUND_CATALOG = computed<MapBackgroundDef[]>(() => dbCatalogData.value ?? [])

    function getMapBackgroundImage(itemKey: string | null | undefined): string {
        if (!itemKey) return DEFAULT_BACKGROUND_IMAGE
        return MAP_BACKGROUND_CATALOG.value.find(b => b.itemKey === itemKey)?.image ?? DEFAULT_BACKGROUND_IMAGE
    }

    return { MAP_BACKGROUND_CATALOG, getMapBackgroundImage, DEFAULT_BACKGROUND_IMAGE }
}
