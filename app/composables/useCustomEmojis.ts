export interface CustomEmoji {
    id: number
    shortcode: string
    imageUrl: string
    category: string | null
    tags: string | null // 공백으로 구분된 검색 키워드
}

// 우리 서버 커스텀 이모지 목록을 한 번 fetch해서 전역 캐싱 — { shortcode: imageUrl } 맵과
// 피커용 배열을 같이 제공. 관리자가 설정에서 추가/삭제/수정하면 invalidate() 후 다시 불러오면 됨
export const useCustomEmojis = () => {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl

    const list = useState<CustomEmoji[]>('custom-emojis-list', () => [])
    const map = useState<Record<string, string>>('custom-emojis-map', () => ({}))
    const loaded = useState<boolean>('custom-emojis-loaded', () => false)

    // 지금까지 쓰인 카테고리 전체(중복 제거, 가나다순) — 관리자 업로드 폼 자동완성과
    // 피커의 카테고리 칩 목록이 이걸 그대로 씀
    const categories = computed(() =>
        [...new Set(list.value.map((e) => e.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'ko')),
    )

    async function ensureLoaded() {
        if (loaded.value) return
        loaded.value = true
        try {
            const rows = await $fetch(`${apiBaseUrl}/api/getCustomEmojis`) as CustomEmoji[]
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

    return { list, map, categories, ensureLoaded, invalidate }
}
