// 서버(buyItem.ts)와 클라이언트(WindowShop.vue) 양쪽에서 "이 카테고리가 개수를 여러 개 쌓을 수
// 있는지"를 똑같이 판단해야 해서 공용으로 뺌 — 서버 쪽은 Nuxt 앱 composable(app/composables)을
// 못 쓰므로 프레임워크 의존 없는 순수 모듈로 shared/에 둠.
//
// 아바타 파츠(avatar_*)와 terrain은 "있다/없다"만 의미가 있어서 제외 — 캐릭터에 장착하거나 맵
// 한 칸에 심는 지형이라 여러 개 들고 있을 이유가 없음. 나머지(map_item/functional/consumable)는
// 여러 개 놓거나(맵 아이템), 여러 번 쓰거나(기능/소모품) 할 수 있어서 개수를 세야 함
export const STACKABLE_CATEGORIES = ['map_item', 'functional', 'consumable']

export function isStackableCategory(category: string): boolean {
    return STACKABLE_CATEGORIES.includes(category)
}

// 유효한 카테고리 전체 목록 — 관리자 아이템 생성/수정 서버 검증에 씀. 아바타 파츠는
// app/composables/useCharacter.ts CHARACTER_PARTS와 값이 같아야 함(그쪽은 앱 전용 composable이라
// 여기 서버에서 직접 import를 못 해서 이름만 그대로 다시 나열함 — 파츠 종류가 바뀌면 둘 다 손볼 것)
export const AVATAR_CATEGORIES = ['avatar_body', 'avatar_shoes', 'avatar_bottom', 'avatar_top', 'avatar_face', 'avatar_hair']
export const ITEM_CATEGORIES = ['terrain', 'map_item', 'functional', 'consumable']
export const ALL_CATEGORIES = [...AVATAR_CATEGORIES, ...ITEM_CATEGORIES]

export function isValidCategory(category: string): boolean {
    return ALL_CATEGORIES.includes(category)
}
