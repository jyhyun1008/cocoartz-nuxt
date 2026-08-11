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

// 대한민국 단일 커뮤니티라 사실상 유저 전원이 KST(UTC+9, DST 없음)라서 하루 경계도 KST 자정
// 기준으로 나눔(attendanceClaims.claimedDate 참고). 예전엔 UTC 자정 기준이었는데, 그러면 KST로는
// 이미 다음날인 00:00~09:00 KST 사이에도 서버는 여전히 "어제"로 계산해서, 그 시간대에 들어온
// 유저에게 "오늘 이미 출석함"이 잘못 뜨고 출석 알림(빨간 점)도 안 켜지는 문제가 있었음
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function kstDateString(d: Date = new Date()): string {
    return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

// "YYYY-MM-DD" 문자열 자체에 N일을 더하는 순수 캘린더 연산 — 특정 시각이 아니라 날짜끼리의
// 산술이라 타임존 변환이 필요 없음(위 kstDateString이 만들어준 문자열을 그대로 입력으로 받음)
export function addDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}
