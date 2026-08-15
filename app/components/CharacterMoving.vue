<template>
    <div id="character-wrapper" :class="{ 'handheld-anim': props.animateSelf && !props.tileMode, 'tile-mode': props.tileMode, 'jump-anim': props.jumping }" :style="tileWrapperStyle">
        <Transition name="bubble-fade">
            <div v-if="bubbleText" class="speech-bubble" v-html="renderBubbleText(bubbleText)"></div>
        </Transition>
        <div id="character" :style="characterScale">
            <!-- 데코(몸 앞/뒤) — 다른 파츠보다 세로로 100px(스케일 반영 시 50px) 더 큰 별도 스프라이트라
                 top/bottom 슬라이스 분할 없이 통짜 이미지 하나로 머리 위 여유 공간까지 그대로 보여줌.
                 ⚠️ 몸 앞/뒤는 DOM 순서가 아니라 z-index로 정함(둘 다 여기 나란히 둠) — 캐릭터가
                 위쪽(KeyW, row=3, 뒷모습)을 볼 때는 앞/뒤가 반대로 뒤집혀야 하기 때문. 예를 들어
                 "몸 뒤" 데코(등 뒤 날개 등)는 캐릭터가 정면/측면을 볼 땐 몸통에 가려져야 정상이지만,
                 뒷모습(등을 보여주는 자세)에서는 그 등에 붙은 게 카메라 쪽으로 와서 오히려 몸통보다
                 앞에 보여야 함 — applyFrame이 row===3일 때 두 데코의 z-index를 서로 바꿔줌 -->
            <div v-if="props.backDeco" class="char-deco-viewport" :ref="el => { if (el) charDecoBackContainerEl = el }">
                <img :ref="el => { if (el) charDecoBackEl = el }" class="char-deco-sprite" :src="props.backDeco" />
            </div>
            <div v-if="props.frontDeco" class="char-deco-viewport" :ref="el => { if (el) charDecoFrontContainerEl = el }">
                <img :ref="el => { if (el) charDecoFrontEl = el }" class="char-deco-sprite" :src="props.frontDeco" />
            </div>
            <!-- 뒷머리 — 정면(row===0)에서만 몸통 뒤에 보여줌(applyFrame이 display 토글).
                 hair와 같은 파일을 시트의 마지막 줄(뒷모습 프레임, row 3)로만 다르게 크롭해서
                 긴 머리가 몸에 안 가려지고 뒤로 흘러나온 것처럼 보이게 함 -->
            <div v-if="props.backHair" class="char-back-hair-viewport" :ref="el => { if (el) charBackHairContainerEl = el }">
                <img :ref="el => { if (el) charBackHairEl = el }" class="char-back-hair-sprite" :src="props.backHair" />
            </div>
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
    // 지금 서 있는 층(0=바닥, 1=1층, 2=2층) — 타일/아이템의 z 오프셋과 같은 식으로 화면에서
    // 그만큼 떠 보이게 함(RoomMap.vue의 getTileContainerStyle/MapItem.vue의 sideH와 동일한 계산)
    localZ: { type: Number, default: 0 },
    zIndex: { type: Number, default: undefined },
    userId: { type: Number, default: null },
    // 스페이스바 점프 — 별도 점프 스프라이트가 없어서 CSS로 살짝 튀어오르는 연출만 재생함
    jumping: { type: Boolean, default: false },
    // 데코(useCharacter.ts getCharacterLayers가 계산해서 넘겨줌) — 한 번에 최대 하나만 장착되므로
    // 앞/뒤 중 실제로 있는 쪽 하나만 채워져 있고 나머진 null
    backDeco: { type: String, default: null },
    frontDeco: { type: String, default: null },
    // 뒷머리(useCharacter.ts getCharacterLayers가 hair와 같은 파일을 그대로 내려줌) — 정면에서만 보임
    backHair: { type: String, default: null },
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

// 층(z) 한 칸의 화면상 높이차 — RoomMap.vue의 getTileContainerStyle/MapItem.vue와 완전히 같은 식
// (z가 올라간 만큼 화면에서 그만큼 떠 보이게 함)
const sideH = computed(() => {
    const dynH = props.topRatio * TILE_IMG_H
    const S = (1 - props.topRatio) * TILE_IMG_H
    return dynH * 3 / 4 + S / 2
})

// ⚠️ z-index를 여기(wrapper)가 아니라 #character에 줌 — wrapper에 position+z-index를 같이
// 주면 새 스태킹 컨텍스트가 생겨서 말풍선(.speech-bubble)까지 그 안에 갇혀버림(아이템 뒤로
// 깔리는 몸통 때문에 말풍선까지 같이 가려지는 문제였음, OtherCharacter.vue와 동일한 이유).
const tileWrapperStyle = computed(() => {
    if (!props.tileMode) return {}
    const dynH = props.topRatio * TILE_IMG_H
    return {
        position: 'absolute',
        left: `calc(50% + ${props.localX * (TILE_W / 4) - TILE_W / 2}px)`,
        top: `calc(50% + ${-props.localY * dynH / 2 - tileOffset.value - 48 - props.localZ * sideH.value}px)`,
        width: `${TILE_W}px`,
    }
})

const characterScale = computed(() => {
    if (props.tileMode) {
        return { position: 'relative', zIndex: props.zIndex ?? 'auto' }
    }
    return {
        position: 'relative',
        transform: `scale(${props.zoomLevel})`,
        transformOrigin: 'center 48px',
    }
})

const charTopRefs = []
const charBotRefs = []
let charDecoBackEl = null
let charDecoFrontEl = null
let charDecoBackContainerEl = null
let charDecoFrontContainerEl = null
let charBackHairEl = null
let charBackHairContainerEl = null

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

    // 데코는 몸통과 셀 높이가 달라서(178 vs 128) 자기만의 top 계산을 씀 — col(좌우/방향)은 몸통과 동일
    const decoStyle = `top:${-178 * row}px; left:${-128 * col}px;`
    charDecoBackEl?.setAttribute('style', decoStyle)
    charDecoFrontEl?.setAttribute('style', decoStyle)

    // row===3(KeyW, 뒷모습)일 때만 앞/뒤 데코의 z-index를 서로 바꿈 — 위 템플릿 주석 참고
    const isBackView = row === 3
    charDecoBackContainerEl?.style.setProperty('z-index', isBackView ? '1' : '-1')
    charDecoFrontContainerEl?.style.setProperty('z-index', isBackView ? '-1' : '1')

    // 뒷머리 — row는 항상 3(뒷모습 프레임) 고정, col만 앞머리와 맞춰서 걸을 때 같이 흔들리게 함.
    // 정면(row===0)이 아니면 통째로 숨김(측면/후면은 기존 hair 레이어 하나로 이미 충분함)
    const backHairStyle = `top:${-128 * 3}px; left:${-128 * col}px;`
    charBackHairEl?.setAttribute('style', backHairStyle)
    charBackHairContainerEl?.style.setProperty('display', row === 0 ? 'block' : 'none')
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
    // 멈췄을 때 기본값(아래를 보는 row 0)으로 되돌리는 대신, 마지막으로 걷던 방향을 그대로
    // 보고 서 있게 하기 위해 따로 기억해둠 — playAnim이 호출될 때마다(=키를 누르고 있는 동안)
    // 갱신되고, stopAnim은 이 값을 그대로 씀
    let lastRow = 0

    function playAnim(code) {
        frameIdx = 0
        lastRow = FRAMES[code][0].row
        clearInterval(animInterval)
        animInterval = setInterval(() => {
            applyFrame(FRAMES[code][frameIdx])
            frameIdx = (frameIdx + 1) % 4
        }, 150)
    }
    function stopAnim() {
        clearInterval(animInterval)
        animInterval = null
        applyFrame({ row: lastRow, col: 1 })
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

/* 데코 — 몸통 스프라이트보다 세로로 50px(스케일 반영) 더 큰 별도 치수라 top/bottom 분할 없이
   통짜 하나로 렌더링함. #character 기준 -50px 위로 올려서 머리 위 여유 공간이 위쪽으로 보이게 하고,
   나머지 128px는 몸통과 같은 자리(발 위치 기준선 동일)에 맞춤 */
.char-deco-viewport {
    position: absolute;
    top: -50px;
    left: 0;
    width: 128px;
    height: 178px;
    overflow: hidden;
    pointer-events: none;
}

.char-deco-sprite {
    position: absolute;
    width: 384px;
    height: 712px;
    top: 0px;
    left: -128px;
}

/* 뒷머리 — 몸통과 같은 128x128 셀 치수(hair와 같은 파일이라 위치 계산도 char-sprite와 동일).
   deco처럼 top/bottom 슬라이스 분할 없이 통짜로 렌더(몸통 뒤 한 겹으로만 살짝 보이는 용도라
   isometric 층 차이에 따른 하단 클리핑까지는 필요 없음). z-index:-1로 body/hair 스택(auto,
   즉 0 취급) 뒤에 고정 — deco처럼 뒤집을 필요가 없으니 always -1 */
.char-back-hair-viewport {
    position: absolute;
    top: 0;
    left: 0;
    width: 128px;
    height: 128px;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
}

.char-back-hair-sprite {
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

/* 점프 스프라이트가 따로 없어서 CSS로만 살짝 튀어오르는 연출 — #character를 움직여서 tile-mode의
   위치 지정(left/top, tileWrapperStyle)과 안 겹치게 함 */
.jump-anim #character {
    animation: jump-hop 0.4s linear;
}

/* 포물선(중력) 느낌 — 올라갈 땐 점점 느려지고(ease-out), 내려갈 땐 점점 빨라지게(ease-in)
   구간별로 timing-function을 따로 줌(하나의 ease-in-out으로는 이 비대칭 느낌이 안 나옴) */
@keyframes jump-hop {
    0% { transform: translateY(0); animation-timing-function: ease-out; }
    50% { transform: translateY(-32px); animation-timing-function: ease-in; }
    100% { transform: translateY(0); }
}
</style>
