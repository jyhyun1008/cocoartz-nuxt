import { createHash, createVerify } from 'node:crypto'
import { fetchActor } from './activitypub'

// 공개키 캐시 (5분 TTL)
const pubKeyCache = new Map<string, { pem: string; expiresAt: number }>()
const KEY_CACHE_TTL = 5 * 60 * 1000

async function fetchPublicKey(keyId: string): Promise<string | null> {
    const now = Date.now()
    const cached = pubKeyCache.get(keyId)
    if (cached && cached.expiresAt > now) return cached.pem

    const actorUrl_ = keyId.replace(/#[^#]*$/, '')
    const actorData = await fetchActor(actorUrl_)
    if (!actorData) return null

    const pubKey = actorData.publicKey as Record<string, string> | undefined
    if (!pubKey?.publicKeyPem || pubKey.id !== keyId) return null

    pubKeyCache.set(keyId, { pem: pubKey.publicKeyPem, expiresAt: now + KEY_CACHE_TTL })
    return pubKey.publicKeyPem
}

// 만료된 캐시 주기적 정리
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of pubKeyCache) {
        if (entry.expiresAt < now) pubKeyCache.delete(key)
    }
}, 60_000)

function parseSignatureParams(header: string): Record<string, string> {
    const params: Record<string, string> = {}
    for (const part of header.split(',')) {
        const m = part.trim().match(/^(\w+)="(.*?)"$/)
        if (m?.[1] != null && m[2] != null) params[m[1]] = m[2]
    }
    return params
}

// Signature 헤더에서 도메인만 빠르게 추출 (HTTP 요청 없음)
export function extractSignatureDomain(signatureHeader: string | undefined): string | null {
    if (!signatureHeader) return null
    const m = signatureHeader.match(/keyId="([^"]+)"/)
    if (!m) return null
    try { return new URL(m[1]!).hostname }
    catch { return null }
}

export async function verifyInboxSignature(
    signatureHeader: string,
    method: string,
    pathname: string,
    getHeader: (name: string) => string | undefined,
    rawBody: Uint8Array | Buffer | string,
    publicDomain?: string,
): Promise<boolean> {
    const params = parseSignatureParams(signatureHeader)
    const { keyId, headers: signedHeaders, signature } = params

    if (!keyId || !signedHeaders || !signature) return false

    // 캐시된 공개키 사용
    const publicKeyPem = await fetchPublicKey(keyId)
    if (!publicKeyPem) return false

    // Digest 검증
    const digestHeader = getHeader('digest')
    if (digestHeader?.startsWith('SHA-256=')) {
        const expected = digestHeader.slice(8)
        const buf = typeof rawBody === 'string' ? Buffer.from(rawBody) : Buffer.from(rawBody)
        const actual = createHash('sha256').update(buf).digest('base64')
        if (actual !== expected) {
            console.warn('[signature] Digest 불일치')
            return false
        }
    }

    // 서명 문자열 재구성
    const signingString = signedHeaders
        .split(' ')
        .map((h) => {
            if (h === '(request-target)') return `(request-target): ${method.toLowerCase()} ${pathname}`
            if (h === 'host' && publicDomain) return `host: ${publicDomain}`
            return `${h}: ${getHeader(h) ?? ''}`
        })
        .join('\n')

    try {
        const verify = createVerify('sha256')
        verify.update(signingString)
        return verify.verify(publicKeyPem, signature, 'base64')
    } catch {
        return false
    }
}
