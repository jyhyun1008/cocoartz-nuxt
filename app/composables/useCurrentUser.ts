export const useCurrentUser = () => {
    const userId = useCookie<number | null>('user-id', { default: () => null })
    const isLoggedIn = computed(() => !!userId.value)
    return { userId, isLoggedIn }
}
