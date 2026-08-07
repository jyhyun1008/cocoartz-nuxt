interface CoinBubble {
    expiresAt: number
}

const COIN_DURATION_MS = 60000  // 1분간 떠 있음

// 아이템 키(RoomMap.vue가 MapItem 렌더링에 쓰는 `${x}-${y}-${z}-${idx}` 형식) -> 지금 코인이
// 떠 있는지. 나(이 브라우저)한테만 보이는 로컬 연출이라 서버로 동기화하지 않음 — useSpeechBubbles와
// 동일한 구조(자기 갱신 가드가 있는 setTimeout 자동 삭제).
export function useCoinBubbles() {
    const coins = useState<Record<string, CoinBubble>>('coin-bubbles', () => ({}))

    function showCoin(key: string) {
        const expiresAt = Date.now() + COIN_DURATION_MS
        coins.value = { ...coins.value, [key]: { expiresAt } }
        setTimeout(() => {
            // 그 사이 수집되거나 새로 갱신됐으면 건드리지 않음
            if (coins.value[key]?.expiresAt !== expiresAt) return
            const next = { ...coins.value }
            delete next[key]
            coins.value = next
        }, COIN_DURATION_MS)
    }

    // 수집됐을 때 즉시(만료 대기 없이) 지움
    function hideCoin(key: string) {
        if (!(key in coins.value)) return
        const next = { ...coins.value }
        delete next[key]
        coins.value = next
    }

    return { coins: readonly(coins), showCoin, hideCoin }
}
