import { db } from '../utils/db'
import { attendanceClaims, currencyBalances } from '../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { requireUserId } from '../utils/session'
import { attendanceRewardFor, kstDateString, addDays } from '../utils/attendance'

export default eventHandler(async (event) => {
    const { serverid } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!serverid) throw createError({ statusCode: 400, message: 'serverid가 필요합니다' })

    const today = kstDateString()
    const yesterday = addDays(today, -1)

    return await db.transaction(async (tx) => {
        // FOR UPDATE로 이 유저의 가장 최근 출석 행을 잠가서, 같은 순간 두 번 요청해도(연타 등)
        // 한쪽이 커밋할 때까지 다른 쪽은 대기했다가 unique 제약(userid,serverid,claimedDate)에
        // 걸려 아래 insert가 막힘 — 중복 지급 자체가 원천 차단됨
        const [latest] = await tx.select().from(attendanceClaims)
            .where(and(eq(attendanceClaims.userid, userid), eq(attendanceClaims.serverid, serverid)))
            .orderBy(desc(attendanceClaims.claimedDate))
            .limit(1)
            .for('update')

        if (latest?.claimedDate === today) {
            throw createError({ statusCode: 400, message: '오늘은 이미 출석했어요' })
        }

        const streak = latest?.claimedDate === yesterday ? latest.streak + 1 : 1
        const amount = attendanceRewardFor(streak)

        const [claimRow] = await tx.insert(attendanceClaims)
            .values({ userid, serverid, claimedDate: today, streak, amount })
            .onConflictDoNothing({ target: [attendanceClaims.userid, attendanceClaims.serverid, attendanceClaims.claimedDate] })
            .returning()
        // 위 FOR UPDATE 잠금이 있어서 사실상 여기 걸릴 일은 없지만(같은 유저 행을 순차 처리하게
        // 만들어두었으므로), 혹시 몰라 방어적으로 한 번 더 확인
        if (!claimRow) throw createError({ statusCode: 400, message: '오늘은 이미 출석했어요' })

        const [balanceRow] = await tx.insert(currencyBalances)
            .values({ userid, serverid, balance: amount })
            .onConflictDoUpdate({
                target: [currencyBalances.userid, currencyBalances.serverid],
                set: { balance: sql`${currencyBalances.balance} + ${amount}` },
            })
            .returning()

        return { ok: true, amount, streak, balance: balanceRow.balance }
    })
})
