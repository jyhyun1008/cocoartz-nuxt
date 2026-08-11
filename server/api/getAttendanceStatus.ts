import { db } from '../utils/db'
import { attendanceClaims } from '../db/schema'
import { eq, and, gte, desc } from 'drizzle-orm'
import { requireUserId } from '../utils/session'
import { attendanceRewardFor, kstDateString, addDays } from '../utils/attendance'

// 출석 위젯(WindowAttendance.vue)이 열릴 때 한 번에 필요한 정보 — 오늘 이미 받았는지, 현재
// 연속일수, 이번에 받을 때 예상 금액(미리보기), 최근 한 달 캘린더에 표시할 날짜 목록
export default eventHandler(async (event) => {
    const { serverid } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!serverid) throw createError({ statusCode: 400, message: 'serverid가 필요합니다' })

    const today = kstDateString()

    const [latest] = await db.select().from(attendanceClaims)
        .where(and(eq(attendanceClaims.userid, userid), eq(attendanceClaims.serverid, serverid)))
        .orderBy(desc(attendanceClaims.claimedDate))
        .limit(1)

    const claimedToday = latest?.claimedDate === today
    // 아직 오늘 안 받았으면 "지금 누르면 될" streak를 미리 계산해서 보여줌(어제까지 이어져 있으면 +1, 아니면 1로 리셋)
    const currentStreak = claimedToday
        ? latest.streak
        : (latest?.claimedDate === addDays(today, -1) ? latest.streak + 1 : 1)

    // 캘린더용 — 최근 35일(약 5주) 치 출석 날짜만 뽑아서 내려줌
    const recent = await db.select({ claimedDate: attendanceClaims.claimedDate }).from(attendanceClaims)
        .where(and(
            eq(attendanceClaims.userid, userid),
            eq(attendanceClaims.serverid, serverid),
            gte(attendanceClaims.claimedDate, addDays(today, -34)),
        ))

    return {
        claimedToday,
        currentStreak,
        nextReward: attendanceRewardFor(currentStreak),
        claimedDates: recent.map(r => r.claimedDate),
        today,
    }
})
