import { createHash, createSign, generateKeyPairSync } from 'node:crypto'

export function generateRsaKeyPair() {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    return { publicKey, privateKey }
}

export function buildSignedHeaders(
    privateKeyPem: string,
    keyId: string,
    method: string,
    url: string,
    body?: string,
): Record<string, string> {
    const parsed = new URL(url)
    const date = new Date().toUTCString()

    const headersToSign: string[] = ['(request-target)', 'host', 'date']
    let digestHeader = ''

    if (body) {
        const hash = createHash('sha256').update(body).digest('base64')
        digestHeader = `SHA-256=${hash}`
        headersToSign.push('digest')
    }

    const signingString = headersToSign
        .map((h) => {
            if (h === '(request-target)') return `(request-target): ${method.toLowerCase()} ${parsed.pathname}`
            if (h === 'host') return `host: ${parsed.host}`
            if (h === 'date') return `date: ${date}`
            if (h === 'digest') return `digest: ${digestHeader}`
            return ''
        })
        .join('\n')

    const signature = createSign('sha256').update(signingString).sign(privateKeyPem, 'base64')

    const signatureHeader = [
        `keyId="${keyId}"`,
        `algorithm="rsa-sha256"`,
        `headers="${headersToSign.join(' ')}"`,
        `signature="${signature}"`,
    ].join(',')

    const headers: Record<string, string> = {
        'Content-Type': 'application/activity+json',
        Date: date,
        Signature: signatureHeader,
    }
    if (digestHeader) headers.Digest = digestHeader

    return headers
}
