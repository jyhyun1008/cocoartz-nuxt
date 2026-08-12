// createError({ statusCode, message, data: { code } })를 매번 손으로 쓰는 대신 — message는
// 로그용/아직 이 패턴으로 안 옮겨진 화면을 위한 한국어 폴백이고, code는 클라이언트
// (app/composables/useI18n.ts의 errT())가 다국어 메시지로 바꿔치기할 때 씀.
//
// 기존처럼 그냥 createError({ statusCode, message })만 쓰는 곳은 code가 없을 뿐 여전히
// 정상 동작함(errT()가 알아서 message를 그대로 보여줌) — 그래서 이 함수는 "다국어 대응을
// 새로 추가하는 엔드포인트만" 골라서 쓰면 되고, 한 번에 전체 API를 옮길 필요는 없음.
export function apiError(statusCode: number, code: string, message: string) {
    return createError({ statusCode, message, data: { code } })
}
