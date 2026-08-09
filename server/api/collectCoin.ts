import { db } from '../utils/db'
import { currencyBalances } from '../db/schema'
import { sql } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

// 맵 위 "코인 말풍선"은 클라이언트가 임의로(로컬 랜덤 타이머로) 띄우는 연출이라, 서버는 "진짜
// 코인이 그 자리에 있었는지"는 검증할 수 없음 — 대신 유저당 최소 간격(쿨다운)만 강제해서
// 연타/스크립트로 무한정 긁어가는 것만 막음. 판돈이 낮은 장식성 재화라 이 정도 방어면 충분.
const COLLECT_COOLDOWN_MS = 5000
// 5분에 한 번씩만 뜨는 걸로 바뀌어서(RoomMap.vue) 1~3은 너무 짬 — 그만큼 보상도 올림
const REWARD_MIN = 5
const REWARD_MAX = 15

export default eventHandler(async (event) => {
    const { serverid } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!serverid) throw createError({ statusCode: 400, message: 'serverid가 필요합니다' })

    const amount = REWARD_MIN + Math.floor(Math.random() * (REWARD_MAX - REWARD_MIN + 1))
    const now = new Date()
    const cutoffIso = new Date(now.getTime() - COLLECT_COOLDOWN_MS).toISOString()
    const nowIso = now.toISOString()

    // 예전엔 select로 쿨다운을 먼저 확인하고 나서 따로 insert/update를 했는데, 그 사이 틈에
    // 같은 계정으로 (예: 기기 두 대를 동시에 띄워서) 거의 동시에 두 번 호출하면 둘 다 "쿨다운
    // 통과"로 판정되는 TOCTOU 레이스가 있었음 — 지금은 INSERT..ON CONFLICT DO UPDATE 한 문장
    // 안에서 "쿨다운이 지났을 때만" 갱신하도록 CASE로 조건을 걸어서 원자적으로 처리함(포스트그레스가
    // 같은 행에 대해선 동시 요청을 순차적으로만 커밋하므로, 둘 중 하나만 조건을 통과할 수 있음)
    const [row] = await db.insert(currencyBalances)
        .values({ userid, serverid, balance: amount, lastCollectedAt: now })
        .onConflictDoUpdate({
            target: [currencyBalances.userid, currencyBalances.serverid],
            set: {
                balance: sql`CASE WHEN ${currencyBalances.lastCollectedAt} IS NULL OR ${currencyBalances.lastCollectedAt} < ${cutoffIso}::timestamptz
                    THEN ${currencyBalances.balance} + ${amount}
                    ELSE ${currencyBalances.balance} END`,
                lastCollectedAt: sql`CASE WHEN ${currencyBalances.lastCollectedAt} IS NULL OR ${currencyBalances.lastCollectedAt} < ${cutoffIso}::timestamptz
                    THEN ${nowIso}::timestamptz
                    ELSE ${currencyBalances.lastCollectedAt} END`,
            },
        })
        .returning()

    // 이번 호출로 실제 갱신됐는지는 반환된 lastCollectedAt이 이번에 넣으려던 시각과 같은지로
    // 판별함(쿨다운에 막혀 CASE의 ELSE를 탔으면 기존 값이 그대로 반환됨)
    if (row.lastCollectedAt.getTime() !== now.getTime()) {
        return { ok: false, error: 'too_soon' }
    }

    return { ok: true, amount, balance: row.balance }
})
