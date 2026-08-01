export function isPublicUrl(url: string): boolean {
    try {
        const { protocol, hostname } = new URL(url)
        if (protocol !== 'https:') return false
        const h = hostname.toLowerCase()
        if (/^(localhost|127\.|10\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|0\.)/.test(h)) return false
        if (/^(0x[0-9a-f]+|0[0-7]+)\./.test(h)) return false
        const ipv6 = h.startsWith('[') ? h.slice(1, -1) : h
        if (ipv6 === '::1') return false
        if (/^fe[89ab][0-9a-f]:/i.test(ipv6)) return false
        if (/^f[cd][0-9a-f]{2}:/i.test(ipv6)) return false
        if (/^::ffff:/i.test(ipv6)) return false
        if (h.endsWith('.local')) return false
        return true
    } catch {
        return false
    }
}
