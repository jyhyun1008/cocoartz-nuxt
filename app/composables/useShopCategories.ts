import { CHARACTER_PARTS } from './useCharacter'

// 상점(WindowShop.vue)과 인벤토리(@[username].vue) 양쪽에서 같은 카테고리 탭 구성을 써야 해서 공용으로 뺌.
// 새 카테고리를 추가하려면 여기 한 곳만 고치면 됨(단, items.category에 쓰는 실제 문자열 값도 맞춰야 함 — server/db/schema.ts 주석 참고)
const AVATAR_PART_LABELS: Record<string, string> = { hair: '헤어', top: '상의', bottom: '하의', shoes: '신발', face: '얼굴', body: '바디' }

export function useShopCategories() {
    const mainTabs = [
        { id: 'avatar', label: '아바타', icon: 'hgi hgi-stroke hgi-user-square' },
        { id: 'item', label: '아이템', icon: 'hgi hgi-stroke hgi-package' },
    ]
    const avatarSubTabs = CHARACTER_PARTS.map(part => ({ id: `avatar_${part}`, label: AVATAR_PART_LABELS[part] ?? part }))
    const itemSubTabs = [
        { id: 'terrain', label: '지형' },
        { id: 'map_item', label: '맵 아이템' },
        { id: 'map_background', label: '맵 배경' },
        { id: 'functional', label: '기능 아이템' },
        { id: 'consumable', label: '소모품' },
    ]
    // category 값 → 상점/인벤토리에 표시할 한글 라벨 (배지 등에 씀)
    const categoryLabel = (category: string) =>
        [...avatarSubTabs, ...itemSubTabs].find(t => t.id === category)?.label ?? category

    return { mainTabs, avatarSubTabs, itemSubTabs, categoryLabel }
}
