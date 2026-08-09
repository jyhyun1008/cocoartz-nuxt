// 채널 사이드바의 접속중인 유저 목록(ServerSidebar.vue)이나 맵 위의 다른 유저 아바타
// (RoomMap.vue/OtherCharacter.vue)를 눌렀을 때 뜨는 미니 프로필 카드 — 여러 곳에서 같은 카드
// 하나를 공유해서 써야 해서(팝업이 두 개 겹쳐 뜨면 안 되니) useState로 상태만 여기 두고, 실제
// 렌더링은 UserProfileCard.vue를 딱 한 군데(ServerSidebar.vue — RoomMap.vue가 뜨는 페이지엔
// 항상 같이 있음)에만 마운트해서 그 컴포넌트가 이 상태를 구독하는 식으로 씀.
//
// 이미 갖고 있는 최소 정보(웹소켓 presence/room_state가 내려주는 users 테이블 그대로)만으로
// 카드를 바로 그려서 별도 로딩 없이 즉시 뜨게 함 — "프로필로 이동"을 눌렀을 때만 실제 프로필
// 페이지로 가서 나머지(팔로워 수, 소개 등)를 보게 함.
export interface ProfileCardUser {
    username: string
    knownas?: string | null
    avatar?: string | null
}

export function useProfileCard() {
    const profileCardTarget = useState<ProfileCardUser | null>('profile-card-target', () => null)
    // 클릭한 지점 근처에 카드를 띄우기 위한 좌표 — 화면 좌표(clientX/clientY) 그대로 저장해두고
    // UserProfileCard.vue가 화면 밖으로 안 나가게 clamp해서 씀
    const profileCardPos = useState<{ x: number; y: number }>('profile-card-pos', () => ({ x: 0, y: 0 }))

    function openProfileCard(user: ProfileCardUser | null | undefined, event?: MouseEvent | null) {
        if (!user?.username) return  // 손님(게스트)은 계정이 없어 username이 없음 — 카드 자체를 안 띄움
        profileCardTarget.value = { username: user.username, knownas: user.knownas ?? null, avatar: user.avatar ?? null }
        if (event) profileCardPos.value = { x: event.clientX, y: event.clientY }
    }
    function closeProfileCard() {
        profileCardTarget.value = null
    }

    return { profileCardTarget, profileCardPos, openProfileCard, closeProfileCard }
}
