// 현재 로그인 유저의 풀 데이터를 한 번 fetch해서 전역 캐싱
export const useCurrentUserData = () => {
    const { userId } = useCurrentUser()
    const userData = useState<any>('current-user-full', () => null)
    const loaded = useState<boolean>('current-user-loaded', () => false)

    async function ensureLoaded() {
        if (loaded.value || !userId.value) return
        loaded.value = true
        try {
            userData.value = await $fetch('/api/getUserById', {
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
