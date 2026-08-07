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

export const ITEM_CATALOG: MapItemDef[] = [
    {
        id: 1,
        name: '무지개 기둥',
        layers: [1, 2, 3, 4, 5, 6].map(n => `/item/1/${n}.png`),
    },
    {
        id: 2,
        name: '아이템 2',
        layers: [1, 2, 3, 4, 5, 6].map(n => `/item/2/${n}.png`),
    },
]

export function useItemCatalog() {
    function getItemDef(itemid: number) {
        return ITEM_CATALOG.find(i => i.id === itemid)
    }
    function getItemLayers(itemid: number) {
        return getItemDef(itemid)?.layers ?? []
    }
    function getItemFlipBackOffsets(itemid: number) {
        return getItemDef(itemid)?.flipBackOffsets ?? []
    }
    return { ITEM_CATALOG, getItemDef, getItemLayers, getItemFlipBackOffsets }
}
