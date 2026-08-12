// 손님(비로그인) 접속은 server/routes/_ws.ts의 nextGuestId()가 매 join마다 새로 찍어주는 음수 id만
// 갖고 있고 실제 계정 정보(user)가 없어서, 화면에 다 똑같이 "?"로만 보여 여러 손님이 동시에
// 있어도 서로 구분이 안 됐음 — 이미 받고 있는 userId(음수)로 "Guest-1234" 식 표시용 이름을 만들어줌.
//
// ⚠️ 진짜 신원이 아니라 그 접속 하나에 대한 임시 라벨일 뿐 — 같은 손님이 방을 옮기거나 재접속하면
// 매번 새 id를 받으므로(useRoomSocket.ts/connect의 재연결 로직 참고) 숫자도 그때마다 바뀜
export function guestLabel(userId: number | null | undefined): string | null {
    if (userId == null || userId >= 0) return null // 손님(음수 id) 아니면 이 라벨을 쓸 이유가 없음
    return `Guest-${String(Math.abs(userId) % 10000).padStart(4, '0')}`
}
