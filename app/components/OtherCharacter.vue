<template>
    <div class="oc-wrapper" :style="wrapperStyle">
        <Transition name="bubble-fade">
            <div v-if="bubbleText" class="speech-bubble">{{ bubbleText }}</div>
        </Transition>
        <div class="oc-body">
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
    zIndex: { type: Number, default: undefined },
    direction: { type: String, default: null },
    name: { type: String, default: '?' },
    userId: { type: Number, default: null },
})

const { bubbles } = useSpeechBubbles()
const bubbleText = computed(() => props.userId != null ? bubbles.value[props.userId]?.text : null)

const tileOffset = computed(() => {
    const dynH = props.topRatio * TILE_IMG_H
    return Math.round(16 + 64 - dynH / 2)
})

const wrapperStyle = computed(() => {
    const dynH = props.topRatio * TILE_IMG_H
    return {
        position: 'absolute',
        zIndex: props.zIndex ?? 'auto',
        left: `calc(50% + ${props.localX * (TILE_W / 4) - TILE_W / 2}px)`,
        top: `calc(50% + ${-props.localY * dynH / 2 - tileOffset.value - 48}px)`,
        width: `${TILE_W}px`,
        transition: 'left 0.15s, top 0.15s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        pointerEvents: 'none',
    }
})

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

watch(() => props.direction, (dir) => {
    if (animInterval) { clearInterval(animInterval); animInterval = null }
    if (!dir || !FRAMES[dir]) {
        frame.value = { row: 0, col: 1 }
        return
    }
    let idx = 0
    animInterval = setInterval(() => {
        frame.value = FRAMES[dir][idx]
        idx = (idx + 1) % 4
    }, 150)
})

onUnmounted(() => { if (animInterval) clearInterval(animInterval) })
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
