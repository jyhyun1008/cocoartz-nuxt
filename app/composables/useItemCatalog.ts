// 맵에 배치 가능한 아이템(스프라이트 스태킹) 카탈로그.
// itemid는 맵 JSON(mapInfo[1])에 저장되는 값과 매칭됨 — 여기서 id를 바꾸면 이미 저장된 맵이 깨지니
// 새 아이템은 항상 새 id로 추가하고, 기존 id는 손대지 않는 걸 권장.
export interface MapItemDef {
    id: number
    name: string
    layers: string[]
    // "뒤로 돌리기"(MapItem.vue flipBack) 켰을 때 레이어별로 추가로 얹는 이미지 내부 보정 오프셋
    // (topRatio=0.5 기준 px, 위로 이동이 양수) — 명시적으로 안 주면 MapItem.vue가 자동으로
    // "레이어 중앙에서 멀어질수록 layerHeight/레이어수 배씩 벌어지는" 기본 공식을 씀.
    // 아이템1(무지개 기둥)·아이템2 둘 다 튜너로 맞춰본 값이 이 기본 공식이랑 거의 일치해서
    // (튜너: https://claude.ai/code/artifact/3d5c1fed-...) 지금은 아무 아이템도 명시적으로 안 씀 —
    // 새 아이템이 기본 공식으로 이상하게 나올 때만 여기 값을 직접 넣어서 덮어쓰면 됨
    flipBackOffsets?: number[]
}

// 상점 기능 이전부터 코드에 박혀있던 레거시 아이템 — 새 맵 아이템은 이제 관리자 페이지
// (WindowSettings.vue "상점 아이템" 탭)에서 6장 레이어를 업로드해서 등록하면 items 테이블
// (category='map_item')에 들어가고, server/api/getMapItemCatalog.ts를 거쳐 아래 useItemCatalog가
// 이 배열과 합쳐줌. 새 아이템을 여기 직접 추가하지 말 것 — 관리자 페이지를 쓸 것.
// id 1(무지개 기둥)은 삭제함(2026-08-08) — 상점에서도 빼고 유일하게 배치돼있던 마을 방 맵에서도
// 같이 치웠음. id를 재사용하면 예전에 그 자리에 저장돼있던 맵이 있을 경우 엉뚱한 그림이 나올 수
// 있으니, 다음에 새 아이템을 추가할 땐 1을 다시 쓰지 말고 새 id(관리자 페이지로 추가하면 자동)를 쓸 것.
export const STATIC_ITEM_CATALOG: MapItemDef[] = [
    {
        id: 2,
        name: '아이템 2',
        layers: [1, 2, 3, 4, 5, 6].map(n => `/item/2/${n}.png`),
    },
]

export function useItemCatalog() {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl

    // DB 쪽(관리자가 등록한 맵 아이템)은 장식성 추가 데이터라 SSR을 안 기다리고 클라이언트에서만
    // 불러옴 — RoomMap.vue/WindowMapEditor.vue 양쪽에서 같은 키로 호출되니 한 번만 fetch됨
    const { data: dbCatalogData } = useAsyncData(
        'db-map-item-catalog',
        () => $fetch<MapItemDef[]>(`${apiBaseUrl}/api/getMapItemCatalog`).catch(() => []),
        { server: false },
    )

    const ITEM_CATALOG = computed<MapItemDef[]>(() => {
        const dbItems = dbCatalogData.value ?? []
        const dbIds = new Set(dbItems.map(i => i.id))
        // 이론상 겹칠 일은 없지만(관리자 아이템은 항상 자기 DB PK를 itemKey로 씀), 혹시 겹치면
        // DB 쪽을 우선함(관리자가 의도적으로 손본 값일 수 있으므로)
        return [...STATIC_ITEM_CATALOG.filter(i => !dbIds.has(i.id)), ...dbItems]
    })

    function getItemDef(itemid: number) {
        return ITEM_CATALOG.value.find(i => i.id === itemid)
    }
    function getItemLayers(itemid: number) {
        return getItemDef(itemid)?.layers ?? []
    }
    function getItemFlipBackOffsets(itemid: number) {
        return getItemDef(itemid)?.flipBackOffsets ?? []
    }
    return { ITEM_CATALOG, getItemDef, getItemLayers, getItemFlipBackOffsets }
}
