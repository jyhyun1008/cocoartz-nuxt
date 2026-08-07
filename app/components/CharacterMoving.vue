<template>
    <div id="character-wrapper" :class="{ 'handheld-anim': props.animateSelf && !props.tileMode, 'tile-mode': props.tileMode }" :style="tileWrapperStyle">
        <Transition name="bubble-fade">
            <div v-if="bubbleText" class="speech-bubble" v-html="renderBubbleText(bubbleText)"></div>
        </Transition>
        <div id="character" :style="characterScale">
            <div class="char-slice char-slice-top" :style="charTopSliceStyle">
                <img
                    v-for="(layer, i) in props.layers"
                    :key="layer"
                    :ref="el => { if (el) charTopRefs[i] = el }"
                    class="char-sprite"
                    :src="layer"
                />
            </div>
            <div class="char-slice char-slice-bottom" :style="charBottomSliceStyle">
                <img
                    v-for="(layer, i) in props.layers"
                    :key="layer"
                    :ref="el => { if (el) charBotRefs[i] = el }"
                    class="char-sprite char-sprite-bottom"
                    :src="layer"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
const TILE_W = 128
const TILE_IMG_H = 128

const props = defineProps({
    layers: { type: Array, default: () => ['/character/body/1.png', '/character/face/1.png', '/character/hair/1.png', '/character/bottom/1.png', '/character/shoes/1.png'] },
    topRatio: { type: Number, default: 0.5 },
    zoomLevel: { type: Number, default: 1 },
    animateSelf: { type: Boolean, default: true },
    tileMode: { type: Boolean, default: false },
    localX: { type: Number, default: 0 },
    localY: { type: Number, default: 0 },
    zIndex: { type: Number, default: undefined },
    userId: { type: Number, default: null },
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
    if (!props.tileMode) return 0
    const dynH = props.topRatio * TILE_IMG_H
    return Math.round(16 + 64 - dynH / 2)
})

const tileWrapperStyle = computed(() => {
    if (!props.tileMode) return {}
    const dynH = props.topRatio * TILE_IMG_H
    return {
        position: 'absolute',
        zIndex: props.zIndex ?? 'auto',
        left: `calc(50% + ${props.localX * (TILE_W / 4) - TILE_W / 2}px)`,
        top: `calc(50% + ${-props.localY * dynH / 2 - tileOffset.value - 48}px)`,
        width: `${TILE_W}px`,
    }
})

const characterScale = computed(() => {
    if (props.tileMode) return {}
    return {
        transform: `scale(${props.zoomLevel})`,
        transformOrigin: 'center 48px',
    }
})

const charTopRefs = []
const charBotRefs = []

const charBottomH = computed(() => {
    if (props.tileMode) return 64
    const z = props.zoomLevel
    if (z >= 1) return 64
    const t = (z - 0.7) / 0.3
    return Math.round(31 + 33 * t)
})

const charTopSliceStyle = computed(() => ({
    height: '64px',
    overflow: 'hidden',
}))

const charBottomSliceStyle = computed(() => {
    const ratio = props.topRatio
    const h = charBottomH.value
    const base = { height: `${h}px`, overflow: 'hidden' }
    if (ratio <= 0.5 || h <= 0) return base
    const t = (ratio - 0.5) / 0.5
    const margin = Math.round(t * 20)
    return { ...base, clipPath: `polygon(0% 0%, 100% 0%, ${100 - margin}% 100%, ${margin}% 100%)` }
})

let currentFrame = { row: 0, col: 1 }

function applyFrame({ row, col }) {
    currentFrame = { row, col }
    const topStyle = `top:${-128 * row}px; left:${-128 * col}px;`
    charTopRefs.forEach(el => el?.setAttribute('style', topStyle))
    const h = charBottomH.value
    const botStyle = `top:${-(2 * row + 1) * h}px; left:${-128 * col}px; height:${8 * h}px; width:384px;`
    charBotRefs.forEach(el => el?.setAttribute('style', botStyle))
}

onMounted(() => {
    const FRAMES = {
        KeyS: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 1 }],
        KeyW: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 1 }],
        KeyD: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 1 }],
        KeyA: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 1 }],
    }

    watch(charBottomH, () => { applyFrame(currentFrame) })

    applyFrame({ row: 0, col: 1 })

    // 눌려있는 이동 키들을 순서대로 추적 — 이전엔 keydown마다 "다음 keyup 아무거나"에 반응하는
    // 1회성 리스너를 새로 달아서, A를 누른 채로 B를 눌렀다가 A를 떼면(B는 계속 누른 채) A의
    // keyup에 B의 리스너까지 같이 반응해서 B를 누르고 있는데도 애니메이션이 idle로 꺼져버렸음.
    // 이제 keyup마다 "그 키"만 목록에서 빼고, 아직 다른 키가 눌려있으면 그 키로 계속 재생함.
    const activeKeys = []
    let animInterval = null
    let frameIdx = 0

    function playAnim(code) {
        frameIdx = 0
        clearInterval(animInterval)
        animInterval = setInterval(() => {
            applyFrame(FRAMES[code][frameIdx])
            frameIdx = (frameIdx + 1) % 4
        }, 150)
    }
    function stopAnim() {
        clearInterval(animInterval)
        animInterval = null
        applyFrame({ row: 0, col: 1 })
    }

    function onKeydown(e) {
        if (!FRAMES[e.code] || e.repeat) return
        if (!activeKeys.includes(e.code)) activeKeys.push(e.code)
        playAnim(e.code)
    }
    function onKeyup(e) {
        if (!FRAMES[e.code]) return
        const idx = activeKeys.indexOf(e.code)
        if (idx !== -1) activeKeys.splice(idx, 1)
        if (activeKeys.length > 0) {
            playAnim(activeKeys[activeKeys.length - 1])
        } else {
            stopAnim()
        }
    }

    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup)
    onUnmounted(() => {
        window.removeEventListener('keydown', onKeydown)
        window.removeEventListener('keyup', onKeyup)
        clearInterval(animInterval)
    })
})
</script>

<style>
#character-wrapper {
    width: var(--char-width, calc(100vw - 300px));
    height: var(--char-height, calc(100dvh - 3rem));
    position: fixed;
    bottom: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    pointer-events: none;
}

#character-wrapper.handheld-anim {
    animation: handheld 9s ease-in-out infinite;
}

#character-wrapper.tile-mode {
    width: 128px;
    height: 128px;
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
}

#character {
    width: 128px;
    display: flex;
    flex-direction: column;
    margin-top: calc((100dvh - 3rem) / 2 - 48px);
}

#character-wrapper.tile-mode #character {
    margin-top: 0;
}

.char-slice {
    width: 128px;
    overflow: hidden;
    position: relative;
}

.char-sprite {
    position: absolute;
    width: 384px;
    height: 512px;
    top: 0px;
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

.char-sprite-bottom {
    top: -64px;
}
</style>
