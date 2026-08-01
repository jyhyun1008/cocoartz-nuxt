type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

export function checkRateLimit(key: string, maxCount: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || entry.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return true
    }

    if (entry.count >= maxCount) return false
    entry.count++
    return true
}

// 메모리 누수 방지: 만료된 항목 주기적 제거
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
        if (entry.resetAt < now) store.delete(key)
    }
}, 60_000)
