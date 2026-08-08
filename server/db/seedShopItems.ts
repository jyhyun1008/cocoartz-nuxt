import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { items, userItems, users } from './schema'
import { eq, and, like, inArray } from 'drizzle-orm'
import { AVATAR_CATEGORIES } from '../../lib/shopCategories'

// 상점/인벤토리 UI를 빈 화면 없이 바로 확인해볼 수 있게, 이미 리포에 들어있는 에셋(맵 아이템
// 카탈로그·타일셋·캐릭터 파츠)을 그대로 참조하는 샘플 아이템을 등록함. 진짜 상품 구성은 이 파일을
// 참고해서 관리자가 직접 items 테이블에 넣거나, 여기에 항목을 더 추가해서 다시 실행하면 됨
// (items_category_key_idx 유니크 인덱스라 이미 있는 category+itemKey는 스킵하고 넘어감)
const client = postgres(process.env.DATABASE_URL ?? 'postgresql://cocoartz:cocoartz@localhost:5432/cocoartz', {
    prepare: false,
})
const db = drizzle(client, { schema })

// 캐릭터 파츠 variant "1"(useCharacter.ts DEFAULT_CHARACTER) — 상점 도입 전부터 전원이 이미
// 장착하고 있던 "기본" 세트라 price 0이고, 아래에서 기존 유저 전원 + 앞으로 가입할 유저에게
// 자동으로 인벤토리에 지급함(서버 쪽은 server/api/auth/register.ts에서 같은 목록을 다시 조회함 —
// 파츠나 variant 번호가 바뀌면 두 곳 다 손볼 것). icon은 따로 안 넣음 — AvatarPartIcon.vue가
// itemKey(variant 번호)로 원본 캐릭터 PNG를 CSS로 크롭해서 자동으로 아이콘을 만들어줌
const STARTER_AVATAR_ITEMS = [
    { category: 'avatar_hair', itemKey: '1', name: '기본 헤어' },
    { category: 'avatar_top', itemKey: '1', name: '기본 상의' },
    { category: 'avatar_bottom', itemKey: '1', name: '기본 하의' },
    { category: 'avatar_shoes', itemKey: '1', name: '기본 신발' },
    { category: 'avatar_face', itemKey: '1', name: '기본 얼굴' },
    { category: 'avatar_body', itemKey: '1', name: '기본 바디' },
].map(i => ({ ...i, price: 0, description: '가입하면 기본으로 지급되는 기본 파츠예요.', isDefault: true }))

// 타일셋 기본 5종(/public/tileset/1~5.png) — 아바타 기본 파츠랑 똑같은 원리로 전부 상점
// isDefault 아이템으로 등록해둠. WindowMapEditor.vue의 타일 팔레트가 이제 하드코딩된 목록이 아니라
// 이 카탈로그(+인벤토리 보유 여부)로만 결정되니, 나중에 새 기본 지형을 추가하고 싶으면 코드를
// 안 고치고 관리자 페이지에서 isDefault 켜서 등록하기만 하면 됨(특수지형은 isDefault 끄고 유료로)
const STARTER_TERRAIN_ITEMS = [
    { category: 'terrain', itemKey: '1', name: '잔디', icon: '/tileset/1.png' },
    { category: 'terrain', itemKey: '2', name: '물', icon: '/tileset/2.png' },
    { category: 'terrain', itemKey: '3', name: '모래', icon: '/tileset/3.png' },
    { category: 'terrain', itemKey: '4', name: '돌', icon: '/tileset/4.png' },
    { category: 'terrain', itemKey: '5', name: '나무', icon: '/tileset/5.png' },
].map(i => ({ ...i, price: 0, description: '가입하면 기본으로 지급되는 기본 지형이에요.', isDefault: true }))

const SAMPLE_ITEMS = [
    ...STARTER_AVATAR_ITEMS,
    ...STARTER_TERRAIN_ITEMS,
    // useItemCatalog.ts ITEM_CATALOG의 id와 매칭 — itemKey가 그 id 문자열.
    // "무지개 기둥"(itemKey '1')은 여기 없음 — 상점에서 삭제 요청받아서 뺐음(코드
    // STATIC_ITEM_CATALOG에서도 제거됨). 다시 파는 걸로 바꾸고 싶으면 여기 새로 추가할 것.
    {
        category: 'map_item', itemKey: '2', name: '회색 소파', price: 150,
        icon: '/item/icon/2.png', description: '방/맵에 배치할 수 있는 장식용 오브젝트예요.',
    },
] satisfies (typeof items.$inferInsert)[]

async function run() {
    // 예전(AvatarPartIcon.vue의 CSS 크롭 방식 도입 전) 시드가 avatar_* 아이템에 지금은 삭제된
    // /character/icon/{part}-{variant}.png 파일을 icon으로 박아둔 적이 있음(59be293 → 8675ad9에서
    // 시드 코드는 고쳤지만 onConflictDoNothing 특성상 이미 심어진 DB 행은 그대로 남아있었음).
    // 그땐 avatar_* 렌더링이 icon 필드를 아예 안 봐서 무해했는데, 이제 icon이 "관리자가 새로
    // 업로드한 원본 스프라이트시트" 취급이라(getAvatarPartCatalog.ts) 이 죽은 값이 존재하지 않는
    // 파일을 그대로 렌더링에 쓰려고 해서 404가 남 — 실행할 때마다 안전하게 정리함
    const staleIconCleanup = await db.update(items)
        .set({ icon: null })
        .where(and(inArray(items.category, AVATAR_CATEGORIES), like(items.icon, '/character/icon/%')))
        .returning({ name: items.name })
    if (staleIconCleanup.length) {
        console.log(`🧹 죽은 아바타 아이콘 경로 정리: ${staleIconCleanup.map(r => r.name).join(', ')}`)
    }

    for (const item of SAMPLE_ITEMS) {
        const [row] = await db.insert(items).values(item)
            .onConflictDoNothing({ target: [items.category, items.itemKey] })
            .returning()
        console.log(row ? `✅ 등록: ${item.name}` : `⚠️  이미 존재해서 스킵: ${item.category}/${item.itemKey}`)
    }

    // isDefault로 표시된 아이템(지금은 기본 아바타 세트)은 상점 도입 이전부터 전원이 쓰고 있던
    // 것이므로, 기존 유저 전원에게도 인벤토리로 소급 지급함(안 그러면 인벤토리엔 안 뜨는데 캐릭터엔
    // 이미 장착된 이상한 상태가 됨). 관리자 페이지에서 새로 isDefault를 켠 아이템이 있으면 이 스크립트를
    // 다시 돌려서 기존 유저들한테도 소급 지급할 수 있음(이미 가진 사람은 onConflictDoNothing으로 스킵)
    const starterItemRows = await db.select({ id: items.id }).from(items).where(eq(items.isDefault, true))
    const allUsers = await db.select({ id: users.id }).from(users)

    if (starterItemRows.length && allUsers.length) {
        const grants = allUsers.flatMap(u => starterItemRows.map(i => ({ userid: u.id, itemid: i.id, count: 1 })))
        await db.insert(userItems).values(grants).onConflictDoNothing({ target: [userItems.userid, userItems.itemid] })
        console.log(`✅ 기존 유저 ${allUsers.length}명에게 기본 지급 아이템 ${starterItemRows.length}종 소급 지급`)
    }

    await client.end()
}

run().catch((e) => { console.error(e); process.exit(1) })
