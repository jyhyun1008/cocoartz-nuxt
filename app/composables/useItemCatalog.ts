// 맵에 배치 가능한 아이템(스프라이트 스태킹) 카탈로그.
// itemid는 맵 JSON(mapInfo[1])에 저장되는 값과 매칭됨 — 여기서 id를 바꾸면 이미 저장된 맵이 깨지니
// 새 아이템은 항상 새 id로 추가하고, 기존 id는 손대지 않는 걸 권장.
export interface MapItemDef {
    id: number
    name: string
    layers: string[]
}

export const ITEM_CATALOG: MapItemDef[] = [
    {
        id: 1,
        name: '무지개 기둥',
        layers: [1, 2, 3, 4, 5, 6].map(n => `/item/test/${n}.png`),
    },
]

export function useItemCatalog() {
    function getItemDef(itemid: number) {
        return ITEM_CATALOG.find(i => i.id === itemid)
    }
    function getItemLayers(itemid: number) {
        return getItemDef(itemid)?.layers ?? []
    }
    return { ITEM_CATALOG, getItemDef, getItemLayers }
}
