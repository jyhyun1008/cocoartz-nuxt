// server/utils/permissions.ts의 클라이언트 쪽 대응 — 서버 유틸은 server-only(db 접근 등)라
// 그대로 못 불러와서, "이 유저가 이 권한을 가졌는가" 판정 로직만 순수 함수로 복사해둠. 실제
// 인가는 항상 서버(각 API)가 다시 검사하니, 여기 결과는 UI 노출 여부(버튼 보이기/숨기기)에만 씀
// — 이 값만 믿고 서버 쪽 체크를 생략하면 안 됨.
export function userHasPermission(user: { isAdmin?: boolean, permissions?: string | null } | null | undefined, key: string): boolean {
    if (!user) return false
    if (user.isAdmin) return true
    try {
        const parsed = user.permissions ? JSON.parse(user.permissions) : []
        return Array.isArray(parsed) && parsed.includes(key)
    } catch {
        return false
    }
}
