// 현재 로그인 유저의 풀 데이터를 한 번 fetch해서 전역 캐싱
export const useCurrentUserData = () => {
    const { userId } = useCurrentUser()
    const userData = useState<any>('current-user-full', () => null)
    const loaded = useState<boolean>('current-user-loaded', () => false)
    // 일반 $fetch는 SSR 중엔 원 요청의 쿠키를 안 실어 보내서, 페이지를 직접 새로고침/진입할 때마다
    // getUserById가 "로그인 안 함"으로 보고 null을 돌려줌 — 그런데 loaded는 이미 true로 찍혀버려서
    // 클라이언트에서도 재요청을 안 하고 null(→캐릭터 기본값 렌더링)이 그대로 굳어버렸음.
    // useRequestFetch()는 SSR에선 원 요청 헤더(쿠키 포함)를 그대로 넘겨주고 클라이언트에선 그냥
    // $fetch와 동일하게 동작해서 이 문제를 근본적으로 없애줌.
    const requestFetch = useRequestFetch()

    async function ensureLoaded() {
        if (loaded.value || !userId.value) return
        loaded.value = true
        try {
            userData.value = await requestFetch('/api/getUserById', {
                method: 'POST',
                body: { userid: userId.value },
            })
        } catch { userData.value = null }
    }

    function invalidate() {
        loaded.value = false
        userData.value = null
    }

    return { userData, ensureLoaded, invalidate }
}
