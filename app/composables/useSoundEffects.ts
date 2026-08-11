// 짧은 효과음 재생 — 매번 새 Audio 인스턴스를 만들어서(재사용 안 함), 코인을 연달아 먹거나
// 새 글이 거의 동시에 여러 개 들어와도 소리가 서로 안 끊기고 겹쳐서 들리게 함.
// 브라우저 자동재생 정책상 사용자가 페이지와 한 번도 상호작용 안 한 시점엔 play()가 거부될 수
// 있는데, 그런 경우도 흔하고 굳이 알릴 일이 아니라 조용히 무시함.
function play(path: string) {
    if (!import.meta.client) return
    try {
        const audio = new Audio(path)
        audio.volume = 0.5
        void audio.play().catch(() => {})
    } catch {}
}

export function useSoundEffects() {
    return {
        // 코인 획득 시(RoomMap.vue collectCoin 성공)
        playCoinSound: () => play('/sound/coin.mp3'),
        // 연합 게시판/개인 타임라인에 새 글이 실시간으로 도착했을 때
        playUpdateSound: () => play('/sound/update.mp3'),
    }
}
