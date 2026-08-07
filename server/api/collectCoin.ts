import { db } from '../utils/db'
import { currencyBalances } from '../db/schema'
import { and, eq, sql } from 'drizzle-orm'

// 맵 위 "코인 말풍선"은 클라이언트가 임의로(로컬 랜덤 타이머로) 띄우는 연출이라, 서버는 "진짜
// 코인이 그 자리에 있었는지"는 검증할 수 없음 — 대신 유저당 최소 간격(쿨다운)만 강제해서
// 연타/스크립트로 무한정 긁어가는 것만 막음. 판돈이 낮은 장식성 재화라 이 정도 방어면 충분.
const COLLECT_COOLDOWN_MS = 5000
// 5분에 한 번씩만 뜨는 걸로 바뀌어서(RoomMap.vue) 1~3은 너무 짬 — 그만큼 보상도 올림
const REWARD_MIN = 5
const REWARD_MAX = 15

export default eventHandler(async (event) => {
    const { userid, serverid } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!serverid) throw createError({ statusCode: 400, message: 'serverid가 필요합니다' })

    const [existing] = await db.select().from(currencyBalances)
        .where(and(eq(currencyBalances.userid, userid), eq(currencyBalances.serverid, serverid)))

    if (existing?.lastCollectedAt && Date.now() - existing.lastCollectedAt.getTime() < COLLECT_COOLDOWN_MS) {
        return { ok: false, error: 'too_soon' }
    }

    const amount = REWARD_MIN + Math.floor(Math.random() * (REWARD_MAX - REWARD_MIN + 1))
    const now = new Date()

    const [row] = await db.insert(currencyBalances)
        .values({ userid, serverid, balance: amount, lastCollectedAt: now })
        .onConflictDoUpdate({
            target: [currencyBalances.userid, currencyBalances.serverid],
            set: { balance: sql`${currencyBalances.balance} + ${amount}`, lastCollectedAt: now },
        })
        .returning()

    return { ok: true, amount, balance: row.balance }
})
