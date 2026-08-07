import { db } from './db'
import { linkPreviews } from '../db/schema'
import { eq } from 'drizzle-orm'
import { isPublicUrl } from './ap/urlUtils'

export type LinkPreviewData = {
    url: string
    kind: 'generic' | 'youtube' | 'soundcloud'
    title: string | null
    description: string | null
    imageUrl: string | null
    siteName: string | null
    // youtube: watch URL의 video id로 만든 embed URL / soundcloud: oEmbed로 받은 iframe의 src
    embedUrl: string | null
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000
// 가져오기 자체가 실패한 경우까지 7일씩 캐싱해버리면, 일시적으로 안 되던 링크가 그 뒤로도
// 한참 안 뜨는 것처럼 보임 — 실패는 훨씬 짧게 캐싱해서 금방 다시 시도되게 함
// (instanceInfo.ts에서 쓰는 것과 같은 패턴)
const FAILURE_STALE_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 5000
// OGP 태그는 보통 <head> 안, 문서 앞부분만 읽으면 충분 — 대용량 페이지를 통째로 받지 않기 위함
const MAX_HTML_CHARS = 200_000

function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
}

function extractMetaTag(html: string, prop: string): string | null {
    // <meta property="og:title" content="..."> / content가 먼저 오는 순서 둘 다 대응
    const re1 = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${prop}["']`, 'i')
    const match = html.match(re1) || html.match(re2)
    return match ? decodeHtmlEntities(match[1]) : null
}

function extractYoutubeId(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,15})/)
    return m ? m[1] : null
}

async function readHtmlHead(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: { Accept: 'text/html', 'User-Agent': 'CocoArtzBot/1.0 (+link preview)' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const reader = res.body?.getReader()
    if (!reader) return (await res.text()).slice(0, MAX_HTML_CHARS)
    const decoder = new TextDecoder()
    let html = ''
    while (html.length < MAX_HTML_CHARS) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
    }
    reader.cancel().catch(() => {})
    return html
}

async function fetchGenericOgp(url: string): Promise<LinkPreviewData> {
    const html = await readHtmlHead(url)
    return {
        url,
        kind: 'generic',
        title: extractMetaTag(html, 'og:title'),
        description: extractMetaTag(html, 'og:description'),
        imageUrl: extractMetaTag(html, 'og:image'),
        siteName: extractMetaTag(html, 'og:site_name'),
        embedUrl: null,
    }
}

async function fetchSoundcloudEmbed(url: string): Promise<LinkPreviewData> {
    const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { title?: string; html?: string; thumbnail_url?: string; author_name?: string }
    // oEmbed가 돌려준 <iframe> HTML을 그대로 신뢰하지 않고 src만 뽑아서 우리가 직접 iframe을 구성함
    const srcMatch = data.html?.match(/src=["']([^"']+)["']/i)
    return {
        url,
        kind: 'soundcloud',
        title: data.title || null,
        description: data.author_name || null,
        imageUrl: data.thumbnail_url || null,
        siteName: 'SoundCloud',
        embedUrl: srcMatch ? srcMatch[1] : null,
    }
}

function isStale(fetchedAt: Date, isFailure: boolean): boolean {
    const ttl = isFailure ? FAILURE_STALE_MS : STALE_MS
    return Date.now() - fetchedAt.getTime() > ttl
}

function looksLikeFailure(data: LinkPreviewData): boolean {
    return !data.title && !data.embedUrl && !data.imageUrl
}

// URL 하나의 미리보기 정보(OGP 메타/유튜브·사운드클라우드 임베드)를 DB 캐시를 거쳐 반환.
// 유효기간이 지났으면 다시 가져와서 캐시를 갱신함(실패한 결과는 훨씬 짧은 유효기간으로 캐싱)
export async function resolveLinkPreview(url: string): Promise<LinkPreviewData | null> {
    if (!isPublicUrl(url)) return null

    const [cached] = await db.select().from(linkPreviews).where(eq(linkPreviews.url, url))
    if (cached && !isStale(cached.fetchedAt, looksLikeFailure(cached as unknown as LinkPreviewData))) {
        return {
            url: cached.url,
            kind: cached.kind as LinkPreviewData['kind'],
            title: cached.title,
            description: cached.description,
            imageUrl: cached.imageUrl,
            siteName: cached.siteName,
            embedUrl: cached.embedUrl,
        }
    }

    let data: LinkPreviewData
    try {
        const youtubeId = extractYoutubeId(url)
        if (youtubeId) {
            data = {
                url,
                kind: 'youtube',
                title: null,
                description: null,
                imageUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
                siteName: 'YouTube',
                embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
            }
        } else if (/(^|\.)soundcloud\.com$/i.test(new URL(url).hostname)) {
            data = await fetchSoundcloudEmbed(url)
        } else {
            data = await fetchGenericOgp(url)
        }
    } catch {
        data = { url, kind: 'generic', title: null, description: null, imageUrl: null, siteName: null, embedUrl: null }
    }

    if (cached) {
        await db.update(linkPreviews).set({ ...data, fetchedAt: new Date() }).where(eq(linkPreviews.url, url))
    } else {
        await db.insert(linkPreviews).values({ ...data, fetchedAt: new Date() }).onConflictDoNothing({ target: linkPreviews.url })
    }

    return data
}
