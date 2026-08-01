import { isPublicUrl } from './urlUtils'

type InstanceInfo = { name: string | null; themeColor: string | null; iconUrl: string | null }

const EMPTY: InstanceInfo = { name: null, themeColor: null, iconUrl: null }

// 웹앱 매니페스트(manifest.json) 캐시 — 미스키는 name/themeColor/iconUrl을 여기서 내려줌,
// 마스토돈도 대체로 지원함. 실패한 경우도 같이 캐싱해서 매번 다시 두들기지 않게 함
const cache = new Map<string, { data: InstanceInfo; expiresAt: number }>()
const CACHE_TTL = 60 * 60 * 1000

setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache) {
        if (entry.expiresAt < now) cache.delete(key)
    }
}, 10 * 60_000)

function bestIconSrc(icons: unknown): string | null {
    if (!Array.isArray(icons)) return null
    const sizeOf = (icon: Record<string, unknown>) => Number(String(icon.sizes ?? '0x0').split('x')[0]) || 0
    const sorted = [...icons]
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && typeof i.src === 'string')
        .sort((a, b) => sizeOf(b) - sizeOf(a))
    return (sorted[0]?.src as string) ?? null
}

export async function fetchInstanceInfo(host: string): Promise<InstanceInfo> {
    const cached = cache.get(host)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    const origin = `https://${host}`
    const manifestUrl = `${origin}/manifest.json`
    if (!isPublicUrl(manifestUrl)) {
        cache.set(host, { data: EMPTY, expiresAt: Date.now() + CACHE_TTL })
        return EMPTY
    }

    try {
        const res = await fetch(manifestUrl, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const manifest = await res.json() as Record<string, unknown>

        const iconSrc = bestIconSrc(manifest.icons)
        const data: InstanceInfo = {
            name: (manifest.name as string) || (manifest.short_name as string) || null,
            themeColor: (manifest.theme_color as string) || null,
            iconUrl: iconSrc ? new URL(iconSrc, origin).href : null,
        }
        cache.set(host, { data, expiresAt: Date.now() + CACHE_TTL })
        return data
    } catch {
        cache.set(host, { data: EMPTY, expiresAt: Date.now() + CACHE_TTL })
        return EMPTY
    }
}
