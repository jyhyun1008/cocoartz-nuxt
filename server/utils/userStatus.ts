// 로그인 체크(server/api/auth/login.ts), 매 요청 미들웨어(server/middleware/checkBanned.ts),
// 웹소켓 join(server/routes/_ws.ts) 세 군데에서 공통으로 쓰는 "이 유저가 지금 차단 상태인지" 판정.
// 영구정지(bannedAt)가 일시정지보다 우선이고, 일시정지는 suspendedUntil이 아직 미래일 때만 유효
// (시간이 지나면 별도 "해제" 없이 자동으로 다시 정상 상태가 됨).
export function getUserBlockStatus(user: { bannedAt: Date | string | null; suspendedUntil: Date | string | null }) {
    if (user.bannedAt) return { blocked: true as const, kind: 'banned' as const }
    if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) {
        return { blocked: true as const, kind: 'suspended' as const }
    }
    return { blocked: false as const }
}
