// 우리 서버 커스텀 이모지 목록을 한 번 fetch해서 전역 캐싱 — { shortcode: imageUrl } 맵과
// 피커용 배열을 같이 제공. 관리자가 설정에서 추가/삭제하면 invalidate() 후 다시 불러오면 됨
export const useCustomEmojis = () => {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl

    const list = useState<Array<{ id: number; shortcode: string; imageUrl: string }>>('custom-emojis-list', () => [])
    const map = useState<Record<string, string>>('custom-emojis-map', () => ({}))
    const loaded = useState<boolean>('custom-emojis-loaded', () => false)

    async function ensureLoaded() {
        if (loaded.value) return
        loaded.value = true
        try {
            const rows = await $fetch(`${apiBaseUrl}/api/getCustomEmojis`) as Array<{ id: number; shortcode: string; imageUrl: string }>
            list.value = rows
            map.value = Object.fromEntries(rows.map((r) => [r.shortcode, r.imageUrl]))
        } catch {
            list.value = []
            map.value = {}
        }
    }

    function invalidate() {
        loaded.value = false
        return ensureLoaded()
    }

    return { list, map, ensureLoaded, invalidate }
}
