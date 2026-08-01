export const useTheme = () => {
    const theme = useState<'dark' | 'light'>('theme', () => 'dark')

    function apply(t: 'dark' | 'light') {
        theme.value = t
        if (import.meta.client) {
            document.documentElement.dataset.theme = t
            localStorage.setItem('theme', t)
        }
    }

    function toggle() {
        apply(theme.value === 'dark' ? 'light' : 'dark')
    }

    // nuxt.config.ts의 head script가 하이드레이션 전에 document.documentElement.dataset.theme를
    // 이미 정해두므로, 여기서는 그 값을 읽어서 useState(=반응형 상태)에만 동기화해줌
    function init() {
        if (!import.meta.client) return
        const current = document.documentElement.dataset.theme
        theme.value = current === 'light' ? 'light' : 'dark'
    }

    return { theme, toggle, init }
}
