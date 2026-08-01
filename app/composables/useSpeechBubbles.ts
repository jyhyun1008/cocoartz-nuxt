interface Bubble {
    text: string
    expiresAt: number
}

const BUBBLE_DURATION_MS = 10000
const BUBBLE_MAX_CHARS = 20

// userId -> 캐릭터 머리 위에 띄울 최근 채팅 말풍선. 10초 뒤 자동으로 사라지고,
// 그 안에 같은 유저의 새 채팅이 오면 내용/타이머가 갱신됨.
export function useSpeechBubbles() {
    const bubbles = useState<Record<number, Bubble>>('speech-bubbles', () => ({}))

    function showBubble(userId: number | null | undefined, text: string | null | undefined) {
        if (!userId || !text) return
        const clean = text.trim()
        if (!clean) return
        const truncated = clean.length > BUBBLE_MAX_CHARS ? clean.slice(0, BUBBLE_MAX_CHARS) + '...' : clean
        const expiresAt = Date.now() + BUBBLE_DURATION_MS
        bubbles.value = { ...bubbles.value, [userId]: { text: truncated, expiresAt } }
        setTimeout(() => {
            // 그 사이 같은 유저의 새 메시지로 갱신됐으면 건드리지 않음
            if (bubbles.value[userId]?.expiresAt !== expiresAt) return
            const next = { ...bubbles.value }
            delete next[userId]
            bubbles.value = next
        }, BUBBLE_DURATION_MS)
    }

    return { bubbles: readonly(bubbles), showBubble }
}
