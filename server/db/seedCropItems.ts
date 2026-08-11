import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { items } from './schema'
import { eq, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// 첫 농사 작물(밀)을 등록하는 1회성 시드 — public/crops/1/*.png는 이미 리포에 들어있는 로컬
// 에셋이라(오브젝트 스토리지 업로드 없이) 그 경로를 그대로 items.meta.layers에 씀. 이후 새로운
// 작물은 관리자 페이지(설정 > 상점 아이템 관리 > 기능 아이템 > "맵에 심는 작물로 만들기")에서
// 등록하면 되고, 이 스크립트는 그 흐름을 코드 없이도(오브젝트 스토리지 미설정 상태에서도) 먼저
// 하나 심어볼 수 있게 해주는 부트스트랩용임.
const client = postgres(process.env.DATABASE_URL ?? 'postgresql://cocoartz:cocoartz@localhost:5432/cocoartz', {
    prepare: false,
})
const db = drizzle(client, { schema })

const CROP_NAME = '밀'
const CROP_LAYERS = [1, 2, 3, 4, 5, 6].map(n => `/crops/1/${n}.png`)
// 기획대로: 1시간(3600초)에 다 자람, 수확 보상은 20~30 사이 랜덤
const GROW_SECONDS = 60 * 60
const REWARD_MIN = 20
const REWARD_MAX = 30
const PRICE = 30

async function run() {
    const [existing] = await db.select().from(items).where(and(eq(items.category, 'functional'), eq(items.name, CROP_NAME)))
    if (existing) {
        console.log(`⚠️  이미 등록돼있어서 스킵: ${CROP_NAME}(id=${existing.id}) — 성장시간/보상은 관리자 페이지에서 수정하세요.`)
        await client.end()
        return
    }

    // map_item과 같은 방식 — itemKey는 손으로 못 정하고 DB가 발급한 자기 id를 그대로 문자열로 씀
    // (createShopItem.ts의 functional+isCrop 분기와 동일한 규칙). 유니크 인덱스 충돌 방지용
    // 임시값을 먼저 넣고, 발급된 id로 itemKey를 확정함
    const [created] = await db.insert(items).values({
        category: 'functional',
        itemKey: `tmp-${createId()}`,
        name: CROP_NAME,
        description: '심으면 1시간 뒤 다 자라는 밀이에요. 프로필의 개인 홈 맵에 심어보세요.',
        icon: CROP_LAYERS[CROP_LAYERS.length - 1], // 6.png(다 자란 모습)를 상점/인벤토리 썸네일로 씀
        price: PRICE,
        active: true,
        isDefault: false,
        meta: JSON.stringify({ layers: CROP_LAYERS, growSeconds: GROW_SECONDS, rewardMin: REWARD_MIN, rewardMax: REWARD_MAX }),
    }).returning()

    const [final] = await db.update(items)
        .set({ itemKey: String(created.id) })
        .where(eq(items.id, created.id))
        .returning()

    console.log(`✅ 등록: ${final.name}(id=${final.id}) — 성장 ${GROW_SECONDS}초, 보상 ${REWARD_MIN}~${REWARD_MAX}, 가격 ${PRICE}`)
    await client.end()
}

run().catch((err) => {
    console.error(err)
    process.exit(1)
})
