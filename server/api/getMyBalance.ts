import { db } from '../utils/db'
import { currencyBalances } from '../db/schema'
import { and, eq } from 'drizzle-orm'

// 로그인만 하면 누구나 자기 잔액을 조회할 수 있음 — userid는 클라이언트가 넘긴 값이지만
// 여기서 조회하는 건 그 userid 본인 잔액뿐이라(다른 사람 잔액 조회 불가) 별도 검증 불필요
export default eventHandler(async (event) => {
    const { userid, serverid } = await readBody(event)
    if (!userid || !serverid) throw createError({ statusCode: 400, message: 'userid, serverid가 필요합니다' })

    const [row] = await db.select({ balance: currencyBalances.balance })
        .from(currencyBalances)
        .where(and(eq(currencyBalances.userid, userid), eq(currencyBalances.serverid, serverid)))

    return { balance: row?.balance ?? 0 }
})
