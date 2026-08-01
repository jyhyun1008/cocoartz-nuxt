// 악센트 색 위에 올라가는 텍스트/아이콘 색 — 배경이 밝으면 어두운 글자, 어두우면 흰 글자
function accentFgRgbFor(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) return '255,255,255'
    const r = parseInt(m[1].slice(0, 2), 16)
    const g = parseInt(m[1].slice(2, 4), 16)
    const b = parseInt(m[1].slice(4, 6), 16)
    const perceivedBrightness = (r * 299 + g * 587 + b * 114) / 1000
    return perceivedBrightness > 150 ? '30,30,38' : '255,255,255'
}

export const useServer = async () => {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl
    const slug = config.public.serverSlug

    const { data } = await useAsyncData(
        'server-data',
        () => $fetch(`${apiBaseUrl}/api/getServerBySlug`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
        }).then((res: any) => res[0] ?? null),
    )

    // app.vue :root의 기본값과 동일. 여기서 'var(--accent)' 문자열을 그대로 쓰면
    // 각 페이지가 `--accent: v-bind(accent)`로 자기 자신을 참조하는 CSS가 만들어져서
    // (--accent: var(--accent);) 브라우저가 순환 참조로 판단해 값 자체가 무효화됨
    // → 헤더 배경색(`background-color: var(--accent)`)이 안 먹히고 하얗게 보이던 원인
    const DEFAULT_ACCENT = '#D21F3C'
    const DEFAULT_BGACCENT = '#D21F3C22'

    const server = data.value
    const accent = server?.themecolor || DEFAULT_ACCENT
    const bgaccent = server?.themecolor ? `${accent}22` : DEFAULT_BGACCENT
    const accentFgRgb = accentFgRgbFor(accent)

    return { server, slug, accent, bgaccent, accentFgRgb }
}
