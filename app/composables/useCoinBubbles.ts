// 나(이 브라우저)한테만 보이는 로컬 연출이라 서버로 동기화하지 않음 — useSpeechBubbles와 비슷한
// 구조지만, 코인은 유저가 실제로 먹을 때까지(hideCoin) 계속 떠 있어야 해서 자동 만료 타이머는
// 없음(예전엔 1분 뒤 자동으로 사라졌는데, 그동안 못 지나가면 그냥 못 먹고 다음 스폰까지 기다려야
// 해서 너무 빡빡하다는 피드백을 반영함 — RoomMap.vue의 스폰 스케줄링 참고).
export function useCoinBubbles() {
    const coins = useState<Record<string, true>>('coin-bubbles', () => ({}))

    function showCoin(key: string) {
        coins.value = { ...coins.value, [key]: true }
    }

    // 수집됐을 때 지움 — 유일하게 코인이 사라지는 경로
    function hideCoin(key: string) {
        if (!(key in coins.value)) return
        const next = { ...coins.value }
        delete next[key]
        coins.value = next
    }

    return { coins: readonly(coins), showCoin, hideCoin }
}
