// 맵에 배치 가능한 아이템(스프라이트 스태킹) 카탈로그.
// itemid는 맵 JSON(mapInfo[1])에 저장되는 값과 매칭됨 — 여기서 id를 바꾸면 이미 저장된 맵이 깨지니
// 새 아이템은 항상 새 id로 추가하고, 기존 id는 손대지 않는 걸 권장.
export interface MapItemDef {
    id: number
    name: string
    layers: string[]
    // "뒤로 돌리기"(MapItem.vue flipBack) 켰을 때 레이어별로 추가로 얹는 이미지 내부 보정 오프셋
    // (px, 위로 이동이 양수). 180도 회전 때문에 그림이 캔버스 안에서 원래 자리랑 달라져서 층간
    // 간격만으론 안 맞을 때 씀 — 아이템2용으로 튜너(https://claude.ai/code/artifact/3d5c1fed-...)로
    // 직접 맞춘 값. 인덱스는 layers랑 동일(0=1.png). 안 주면 보정 없음
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
        flipBackOffsets: [66, 44, 22, 0, -22, -44],
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
