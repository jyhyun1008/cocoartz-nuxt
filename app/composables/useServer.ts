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

    const server = data.value
    const accent = server?.themecolor ?? 'var(--accent)'
    const bgaccent = server?.themecolor ? `${accent}22` : 'var(--bgaccent)'

    return { server, slug, accent, bgaccent }
}
