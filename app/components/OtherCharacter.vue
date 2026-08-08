<template>
    <div class="oc-wrapper" :class="{ 'jump-anim': isJumping }" :style="wrapperStyle">
        <Transition name="bubble-fade">
            <div v-if="bubbleText" class="speech-bubble" v-html="renderBubbleText(bubbleText)"></div>
        </Transition>
        <div class="oc-body" :style="bodyStyle">
            <div class="oc-slice-top">
                <img
                    v-for="layer in layers"
                    :key="layer"
                    class="oc-sprite"
                    :src="layer"
                    :style="topImgStyle"
                />
            </div>
            <div class="oc-slice-bottom" :style="botSliceStyle">
                <img
                    v-for="layer in layers"
                    :key="layer"
                    class="oc-sprite"
                    :src="layer"
                    :style="botImgStyle"
                />
            </div>
        </div>
        <span class="other-user-name">{{ name }}</span>
    </div>
</template>

<script setup>
const TILE_W = 128
const TILE_IMG_H = 128

const FRAMES = {
    KeyS: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 1 }],
    KeyW: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 1 }],
    KeyD: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 1 }],
    KeyA: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 1 }],
}

const props = defineProps({
    layers: { type: Array, default: () => ['/character/body/1.png', '/character/face/1.png', '/character/hair/1.png', '/character/bottom/1.png', '/character/shoes/1.png'] },
    topRatio: { type: Number, default: 0.5 },
    localX: { type: Number, default: 0 },
    localY: { type: Number, default: 0 },
    // 지금 서 있는 층(0=바닥, 1=1층, 2=2층) — 웹소켓 position 메시지로 받아옴
    localZ: { type: Number, default: 0 },
    zIndex: { type: Number, default: undefined },
    direction: { type: String, default: null },
    name: { type: String, default: '?' },
    userId: { type: Number, default: null },
    // 이 값이 바뀔 때마다(타임스탬프 펄스) 점프 연출을 한 번 재생함 — CharacterMoving.vue의
    // jumping(boolean)과 달리 계속 켜져있는 상태가 아니라 "한 번 튀는" 신호라 이 방식으로 받음
    jumpPulse: { type: Number, default: null },
})

const { bubbles } = useSpeechBubbles()
const bubbleText = computed(() => props.userId != null ? bubbles.value[props.userId]?.text : null)

// 말풍선도 :shortcode: 커스텀 이모지 렌더링 — 텍스트를 먼저 이스케이프한 뒤 치환(유니코드
// 이모지는 twemoji.client.ts가 별도로 처리하므로 그대로 둬도 됨)
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
function renderBubbleText(text) {
    return renderCustomEmojiText(escapeHtml(text), customEmojiMap.value)
}
onMounted(() => {
    ensureCustomEmojisLoaded()
})

const tileOffset = computed(() => {
    const dynH = props.topRatio * TILE_IMG_H
    return Math.round(16 + 64 - dynH / 2)
})

// 층(z) 한 칸의 화면상 높이차 — CharacterMoving.vue/RoomMap.vue의 getTileContainerStyle과 같은 식
const sideH = computed(() => {
    const dynH = props.topRatio * TILE_IMG_H
    const S = (1 - props.topRatio) * TILE_IMG_H
    return dynH * 3 / 4 + S / 2
})

// 점프 연출 — jumpPulse(타임스탬프)가 바뀔 때마다 재생. CharacterMoving.vue와 같은 강제 재시작
// 트릭(false로 껐다가 nextTick에 true) 사용.
const isJumping = ref(false)
let jumpAnimTimer = null
watch(() => props.jumpPulse, (val) => {
    if (val == null) return
    isJumping.value = false
    nextTick(() => { isJumping.value = true })
    clearTimeout(jumpAnimTimer)
    jumpAnimTimer = setTimeout(() => { isJumping.value = false }, 400)
})

// left/top엔 걷기(localX/localY)뿐 아니라 줌(topRatio → dynH/tileOffset)도 같이 들어있어서,
// 걷는 모습을 부드럽게 보이려고 넣은 transition이 줌할 때도 그대로 걸려서 캐릭터가 줌을 못
// 따라가고 붕 뜬 것처럼 뒤늦게 따라오는 문제가 있었음 — topRatio가 바뀌는 순간(=줌 중)만
// transition을 잠깐 꺼서 그 변화는 즉시 반영되고, 그 외(걷기로 인한 변화)엔 그대로 부드럽게 움직임.
// nextTick만으로 껐다 켜면 브라우저가 "transition:none"인 프레임을 실제로 그려보기도 전에
// 이미 다시 켜진 상태로 다음 스타일을 계산해버려서(한 번도 안 그려진 상태는 트랜지션 판단에
// 반영이 안 됨) 여전히 스르륵 움직이는 경우가 있었음 — rAF 두 번으로 최소 한 프레임은
// "꺼진 채로" 실제로 그려지도록 보장함
const suppressTransition = ref(false)
watch(() => props.topRatio, () => {
    suppressTransition.value = true
    requestAnimationFrame(() => {
        requestAnimationFrame(() => { suppressTransition.value = false })
    })
})

// ⚠️ z-index를 여기(wrapper)에 안 주고 .oc-body에만 줌 — wrapper 자체에 z-index를 주면
// position+z-index 조합이 새 스태킹 컨텍스트를 만들어서, 그 안의 닉네임/말풍선까지 전부
// 그 z-index 범위 안에 갇혀버림(아이템 뒤로 깔리는 아바타 몸통 때문에 닉네임까지 같이
// 가려지는 문제였음). wrapper는 z-index 없이(position만) 두고, 몸통(.oc-body)에만 z-index를
// 줘서 몸통만 아이템 뒤로 가고 닉네임/말풍선은 자기 자신의 z-index(10001, 말풍선과 동급)로
// 별도 경쟁하게 함.
const wrapperStyle = computed(() => {
    const dynH = props.topRatio * TILE_IMG_H
    return {
        position: 'absolute',
        left: `calc(50% + ${props.localX * (TILE_W / 4) - TILE_W / 2}px)`,
        top: `calc(50% + ${-props.localY * dynH / 2 - tileOffset.value - 48 - props.localZ * sideH.value}px)`,
        width: `${TILE_W}px`,
        transition: suppressTransition.value ? 'none' : 'left 0.15s, top 0.15s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        pointerEvents: 'none',
    }
})

const bodyStyle = computed(() => ({
    position: 'relative',
    zIndex: props.zIndex ?? 'auto',
}))

const botSliceStyle = computed(() => {
    const ratio = props.topRatio
    const base = { height: '64px', overflow: 'hidden' }
    if (ratio <= 0.5) return base
    const t = (ratio - 0.5) / 0.5
    const margin = Math.round(t * 20)
    return { ...base, clipPath: `polygon(0% 0%, 100% 0%, ${100 - margin}% 100%, ${margin}% 100%)` }
})

// 현재 프레임 (reactive로 관리 → computed style로 연결)
const frame = ref({ row: 0, col: 1 })

const topImgStyle = computed(() =>
    `top:${-128 * frame.value.row}px; left:${-128 * frame.value.col}px;`)

const botImgStyle = computed(() => {
    const h = 64
    return `top:${-(2 * frame.value.row + 1) * h}px; left:${-128 * frame.value.col}px; height:${8 * h}px; width:384px;`
})

let animInterval = null
// 멈췄을 때(direction이 null) 기본값(아래를 보는 row 0)으로 되돌리는 대신, 마지막으로 걷던
// 방향을 그대로 보고 서 있게 하기 위해 따로 기억해둠 — CharacterMoving.vue(내 캐릭터)와 동일한 처리
let lastRow = 0

watch(() => props.direction, (dir) => {
    if (animInterval) { clearInterval(animInterval); animInterval = null }
    if (!dir || !FRAMES[dir]) {
        frame.value = { row: lastRow, col: 1 }
        return
    }
    lastRow = FRAMES[dir][0].row
    let idx = 0
    animInterval = setInterval(() => {
        frame.value = FRAMES[dir][idx]
        idx = (idx + 1) % 4
    }, 150)
})

onUnmounted(() => {
    if (animInterval) clearInterval(animInterval)
    clearTimeout(jumpAnimTimer)
})
</script>

<style>
.oc-wrapper {
    pointer-events: none;
}

.oc-body {
    width: 128px;
    display: flex;
    flex-direction: column;
}

/* @keyframes jump-hop은 CharacterMoving.vue에 정의돼 있음 — 이 파일도 전역 스타일로 번들되니
   그대로 재사용(같은 페이지에 항상 같이 로드되는 컴포넌트라 안전함) */
.jump-anim .oc-body {
    animation: jump-hop 0.4s linear;
}

.oc-slice-top {
    height: 64px;
    width: 128px;
    overflow: hidden;
    position: relative;
}

.oc-slice-bottom {
    width: 128px;
    position: relative;
}

.oc-sprite {
    position: absolute;
    width: 384px;
    height: 512px;
    top: 0;
    left: -128px;
}

.speech-bubble {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 320px;
    padding: 6px 10px;
    background: rgba(255,255,255,0.95); /* 맵 위 이름표는 테마 무관하게 항상 밝은 배지 */
    color: #1a1a22;
    font-size: 0.78rem;
    line-height: 1.35;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    white-space: normal;
    word-break: break-word;
    text-align: center;
    z-index: 10001;
}

.speech-bubble::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(255,255,255,0.95); /* 말풍선 배경과 짝맞춰 테마 무관하게 흰색 고정 */
}

.bubble-fade-enter-active, .bubble-fade-leave-active {
    transition: opacity 0.2s ease;
}
.bubble-fade-enter-from, .bubble-fade-leave-to {
    opacity: 0;
}
</style>
