// 손님(비로그인) 접속은 server/routes/_ws.ts의 nextGuestId()가 매 join마다 새로 찍어주는 음수 id만
// 갖고 있고 실제 계정 정보(user)가 없어서, 화면에 다 똑같이 "?"로만 보여 여러 손님이 동시에
// 있어도 서로 구분이 안 됐음 — 이미 받고 있는 userId(음수)로 "Guest-1234" 식 표시용 이름을 만들어줌.
//
// ⚠️ 진짜 신원이 아니라 그 접속 하나에 대한 임시 라벨일 뿐 — 같은 손님이 방을 옮기거나 재접속하면
// 매번 새 id를 받으므로(useRoomSocket.ts/connect의 재연결 로직 참고) 숫자도 그때마다 바뀜

// nextGuestId()가 -1,-2,-3...처럼 순번 그대로 찍어주는 값이라, 그냥 자리수만 잘라 쓰면
// Guest-0001, Guest-0002...로 이어져 있는 게 티가 남 — 정수 해시(bit-mixing)로 한 번 섞어서
// 순번이 이웃해도 표시되는 숫자는 흩어지게 함(같은 id는 항상 같은 숫자로 나오니 화면 안에서는
// 여전히 안정적으로 같은 사람을 가리킴)
function hashInt(n: number): number {
    n = Math.abs(n) >>> 0
    n = (((n >>> 16) ^ n) * 0x45d9f3b) >>> 0
    n = (((n >>> 16) ^ n) * 0x45d9f3b) >>> 0
    n = ((n >>> 16) ^ n) >>> 0
    return n
}

export function guestLabel(userId: number | null | undefined): string | null {
    if (userId == null || userId >= 0) return null // 손님(음수 id) 아니면 이 라벨을 쓸 이유가 없음
    return `Guest-${String(hashInt(userId) % 10000).padStart(4, '0')}`
}
