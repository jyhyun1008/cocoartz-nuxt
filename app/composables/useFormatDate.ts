// 서버 타임스탬프는 UTC ISO 문자열로 오는데, 예전엔 문자열을 그대로 잘라써서
// (str.split('T')[1]) 보는 사람 로컬 시간이 아니라 UTC 시각이 그대로 찍히던 버그가 있었음.
// Date 객체의 로컬 getter(getHours 등)는 브라우저 타임존을 자동 반영하므로 이걸로 통일함.
export function formatDate(str: string | null | undefined): string {
    if (!str) return ''
    const date = new Date(str)
    if (Number.isNaN(date.getTime())) return ''

    const now = new Date()
    const isToday = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate()

    if (isToday) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 시간 정보 없이 날짜만(가입일 등) — 로컬 타임존 기준 날짜로 변환
export function formatDateOnly(str: string | null | undefined): string {
    if (!str) return ''
    const date = new Date(str)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const useFormatDate = () => ({ formatDate, formatDateOnly })
