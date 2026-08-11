// 출석 보상 공식 — collectCoin.ts(5분마다 5~15)를 기준선으로 삼음: 기본 지급을 그 한 번(대략
// 최소치)보다 조금 넉넉하게 잡고, 연속 출석일수에 비례해 최대 10일치까지만 보너스가 붙게 해서
// "매일 들어오면 이득이지만 하루이틀 빠져도 크게 손해는 아닌" 수준으로 맞춤
export const ATTENDANCE_BASE_REWARD = 15
export const ATTENDANCE_STREAK_BONUS_PER_DAY = 2
export const ATTENDANCE_STREAK_BONUS_CAP_DAYS = 10

export function attendanceRewardFor(streak: number): number {
    const bonusDays = Math.min(Math.max(streak - 1, 0), ATTENDANCE_STREAK_BONUS_CAP_DAYS)
    return ATTENDANCE_BASE_REWARD + bonusDays * ATTENDANCE_STREAK_BONUS_PER_DAY
}

// UTC 기준 "YYYY-MM-DD" — 서버 하나 전체가 같은 기준으로 하루를 나누도록 통일(attendanceClaims.claimedDate 참고)
export function utcDateString(d: Date = new Date()): string {
    return d.toISOString().slice(0, 10)
}

export function addUtcDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return utcDateString(d)
}
