import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { items, userItems, users } from './schema'
import { inArray } from 'drizzle-orm'

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
// 파츠나 variant 번호가 바뀌면 두 곳 다 손볼 것)
const STARTER_AVATAR_ITEMS = [
    { category: 'avatar_hair', itemKey: '1', name: '기본 헤어', icon: '/character/icon/hair-1.png' },
    { category: 'avatar_top', itemKey: '1', name: '기본 상의', icon: '/character/icon/top-1.png' },
    { category: 'avatar_bottom', itemKey: '1', name: '기본 하의', icon: '/character/icon/bottom-1.png' },
    { category: 'avatar_shoes', itemKey: '1', name: '기본 신발', icon: '/character/icon/shoes-1.png' },
    { category: 'avatar_face', itemKey: '1', name: '기본 얼굴', icon: '/character/icon/face-1.png' },
    { category: 'avatar_body', itemKey: '1', name: '기본 바디', icon: '/character/icon/body-1.png' },
].map(i => ({ ...i, price: 0, description: '가입하면 기본으로 지급되는 기본 파츠예요.' }))

const SAMPLE_ITEMS = [
    ...STARTER_AVATAR_ITEMS,
    // useItemCatalog.ts ITEM_CATALOG의 id와 매칭 — itemKey가 그 id 문자열
    {
        category: 'map_item', itemKey: '1', name: '무지개 기둥', price: 150,
        icon: '/item/icon/1.png', description: '방/맵에 배치할 수 있는 장식용 오브젝트예요.',
    },
    {
        category: 'map_item', itemKey: '2', name: '회색 소파', price: 150,
        icon: '/item/icon/2.png', description: '방/맵에 배치할 수 있는 장식용 오브젝트예요.',
    },
    // 지형은 아직 "특수지형" 전용 타일셋이 따로 없어서, 기존 기본 타일 중 하나를 자리표시자로 등록.
    // 실제 특수지형 타일이 추가되면 itemKey를 그 타일 인덱스로 바꿔서 다시 등록할 것
    {
        category: 'terrain', itemKey: '2', name: '특수지형 샘플', price: 100,
        icon: '/tileset/2.png', description: '맵 편집기에서 배치할 수 있는 특수 지형(예시)이에요.',
    },
] satisfies (typeof items.$inferInsert)[]

async function run() {
    for (const item of SAMPLE_ITEMS) {
        const [row] = await db.insert(items).values(item)
            .onConflictDoNothing({ target: [items.category, items.itemKey] })
            .returning()
        console.log(row ? `✅ 등록: ${item.name}` : `⚠️  이미 존재해서 스킵: ${item.category}/${item.itemKey}`)
    }

    // 기본 아바타 세트는 상점 도입 이전부터 전원이 쓰고 있던 것이므로, 기존 유저 전원에게도
    // 인벤토리로 소급 지급함(안 그러면 인벤토리엔 안 뜨는데 캐릭터엔 이미 장착된 이상한 상태가 됨)
    const starterItemRows = await db.select({ id: items.id }).from(items)
        .where(inArray(items.category, STARTER_AVATAR_ITEMS.map(i => i.category)))
    const allUsers = await db.select({ id: users.id }).from(users)

    if (starterItemRows.length && allUsers.length) {
        const grants = allUsers.flatMap(u => starterItemRows.map(i => ({ userid: u.id, itemid: i.id, count: 1 })))
        await db.insert(userItems).values(grants).onConflictDoNothing({ target: [userItems.userid, userItems.itemid] })
        console.log(`✅ 기존 유저 ${allUsers.length}명에게 기본 아바타 ${starterItemRows.length}종 소급 지급`)
    }

    await client.end()
}

run().catch((e) => { console.error(e); process.exit(1) })
