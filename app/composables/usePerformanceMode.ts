// "사양 옵션" — 카메라 흔들림(handheld)이나 창 열렸을 때 배경 블러(피사계심도 느낌) 같은
// 순수 연출용 효과만 끄는 스위치. useTheme.ts와 완전히 같은 패턴(useState + html data-attribute
// + localStorage) — CSS가 :root[data-reduce-effects="true"] 선택자로 각 효과 정의부 바로
// 옆에서 직접 꺼버리게 해뒀음(RoomMap.vue/CharacterMoving.vue/UserRoomEmbed.vue/WindowMapEditor.vue
// 각각의 handheld 애니메이션·블러 규칙 참고). 테마와 달리 하이드레이션 전 깜빡임을 막을 필요는
// 없어서(애니메이션 유무 한 프레임 차이는 테마 색 반전만큼 눈에 띄지 않음) head script 없이
// init()에서 localStorage만 그냥 읽음
export const usePerformanceMode = () => {
    const reduceEffects = useState<boolean>('reduceEffects', () => false)

    function apply(v: boolean) {
        reduceEffects.value = v
        if (import.meta.client) {
            document.documentElement.dataset.reduceEffects = v ? 'true' : 'false'
            localStorage.setItem('reduceEffects', v ? '1' : '0')
        }
    }

    function toggle() {
        apply(!reduceEffects.value)
    }

    function init() {
        if (!import.meta.client) return
        apply(localStorage.getItem('reduceEffects') === '1')
    }

    return { reduceEffects, toggle, init }
}
