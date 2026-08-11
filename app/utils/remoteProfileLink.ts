// 원격(fediverse) 계정 핸들("@user@host" 또는 "user@host")을 내부 프로필 페이지 경로로 변환.
// @[username].vue가 username 파라미터에 '@'가 섞여있으면 리모트 프로필로 처리함(getUserProfile.ts).
export function remoteProfilePath(handle: string | null | undefined): string {
    if (!handle) return '#'
    return `/@${handle.replace(/^@/, '')}`
}
