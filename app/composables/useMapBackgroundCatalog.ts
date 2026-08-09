// 맵 배경(map_background) 카탈로그 — useTerrainCatalog.ts와 완전히 같은 패턴. 맵 JSON의 4번째
// 요소([tiles, items, spawn, background])에 저장된 배경 아이템의 itemKey를 실제 이미지 URL로
// 풀어주는 역할만 함.
//
// "아무것도 안 고른 맵"의 기본 배경은 하드코딩된 파일이 아니라, 관리자가 map_background 카테고리로
// 등록해둔 아이템 중 isDefault(가입 시 기본 지급 체크)가 켜진 것의 icon(오브젝트 스토리지에 올린
// 이미지)을 그대로 씀 — 오브젝트 스토리지 위주로 운영하는 배포 환경에서는 정적 파일(public/*)을
// 바꾸려면 매번 새로 빌드/배포해야 하지만, 상점 아이템으로 등록해두면 관리자 페이지에서 이미지만
// 바꿔 끼우면 되기 때문. 그런 기본 아이템이 아직 하나도 등록 안 됐을 때만 public/mapbg.png로
// 폴백함(그래야 이 기능이 생기기 전부터 있던 모든 맵도 당장은 빈 화면 없이 뭔가 보임).
const FALLBACK_BACKGROUND_IMAGE = '/mapbg.png'

export interface MapBackgroundDef {
    itemKey: string
    name: string
    image: string
    isDefault: boolean
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
        if (itemKey) {
            const found = MAP_BACKGROUND_CATALOG.value.find(b => b.itemKey === itemKey)
            if (found) return found.image
        }
        // 명시적으로 고른 배경이 없거나(itemKey 없음) 고른 배경이 더 이상 없으면(삭제됨) 등록된
        // 기본 지급 배경으로, 그것도 없으면 최후의 폴백으로
        return MAP_BACKGROUND_CATALOG.value.find(b => b.isDefault)?.image ?? FALLBACK_BACKGROUND_IMAGE
    }

    return { MAP_BACKGROUND_CATALOG, getMapBackgroundImage, FALLBACK_BACKGROUND_IMAGE }
}
