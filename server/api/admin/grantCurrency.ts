import { db } from '../../utils/db'
import { users, currencyBalances } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// server/api/collectCoin.ts와 같은 원자적 증가(onConflictDoUpdate) 패턴 — 쿨다운 없이 관리자가
// 입력한 값 그대로 반영. amount가 음수면 차감도 가능(실수로 지급한 걸 되돌릴 때 등)
export default eventHandler(async (event) => {
    const { id, serverid, amount } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)
    if (!id) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })
    if (!serverid) throw createError({ statusCode: 400, message: 'serverid가 필요합니다' })
    const delta = Number(amount)
    if (!Number.isInteger(delta) || delta === 0) {
        throw createError({ statusCode: 400, message: '지급/차감할 정수 값을 입력해주세요' })
    }

    const [row] = await db.insert(currencyBalances)
        .values({ userid: id, serverid, balance: delta })
        .onConflictDoUpdate({
            target: [currencyBalances.userid, currencyBalances.serverid],
            set: { balance: sql`${currencyBalances.balance} + ${delta}` },
        })
        .returning()

    return { ok: true, balance: row.balance }
})
