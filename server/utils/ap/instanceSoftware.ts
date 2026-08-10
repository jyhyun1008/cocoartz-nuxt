import { isPublicUrl } from './urlUtils'

// 상대 서버가 코코아츠인지 nodeinfo(server/routes/.well-known/nodeinfo.get.ts, .../nodeinfo/2.0.json.get.ts —
// 우리 서버가 스스로 노출하는 것과 완전히 같은 표준)로 확인함. 마스토돈/미스키 등도 다 지원하는
// 표준 절차라 별도 API 없이 어느 fediverse 서버든 소프트웨어 이름을 알아낼 수 있음.
// 용도: 코코아츠는 서로 연합해도 자체 CW 기능이 없어서 게시글 제목을 AP의 summary(CW) 자리에
// 그대로 실어보내는데(publishPost.ts), 받는 쪽도 코코아츠 서버로 확인되면 그 summary를 진짜 CW가
// 아니라 "게시글 제목"으로 취급해서 내용을 안 가리고 보여줌(inbox.post.ts의 summaryIsTitle 참고)
const cache = new Map<string, { isCocoArtz: boolean; expiresAt: number }>()
const CACHE_TTL = 60 * 60 * 1000
const FAILURE_CACHE_TTL = 5 * 60 * 1000

setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache) {
        if (entry.expiresAt < now) cache.delete(key)
    }
}, 10 * 60_000)

export async function isCocoArtzInstance(host: string): Promise<boolean> {
    const cached = cache.get(host)
    if (cached && cached.expiresAt > Date.now()) return cached.isCocoArtz

    const result = await detect(host).catch(() => false)
    const ttl = result ? CACHE_TTL : FAILURE_CACHE_TTL
    cache.set(host, { isCocoArtz: result, expiresAt: Date.now() + ttl })
    return result
}

async function detect(host: string): Promise<boolean> {
    const wellKnownUrl = `https://${host}/.well-known/nodeinfo`
    if (!isPublicUrl(wellKnownUrl)) return false

    const wellKnownRes = await fetch(wellKnownUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
    })
    if (!wellKnownRes.ok) return false
    const wellKnown = await wellKnownRes.json() as { links?: Array<{ rel: string; href: string }> }
    // 2.1/2.0 어느 쪽이든 상관없이 nodeinfo 스키마 링크 아무거나 — software.name만 보면 됨
    const link = wellKnown.links?.find((l) => l.rel?.includes('nodeinfo.diaspora.software/ns/schema'))
    if (!link?.href || !isPublicUrl(link.href)) return false

    const infoRes = await fetch(link.href, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
    })
    if (!infoRes.ok) return false
    const info = await infoRes.json() as { software?: { name?: string } }
    return info.software?.name?.toLowerCase() === 'cocoartz'
}
