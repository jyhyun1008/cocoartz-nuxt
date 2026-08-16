<template>
    <div class="oc-wrapper" :class="{ 'jump-anim': isJumping }" :style="wrapperStyle">
        <Transition name="bubble-fade">
            <div v-if="bubbleText" class="speech-bubble" v-html="renderBubbleText(bubbleText)"></div>
        </Transition>
        <div class="oc-body" :style="bodyStyle" @click.stop="$emit('avatar-click', $event)">
            <!-- 데코(몸 앞/뒤) — CharacterMoving.vue와 동일한 이유로 top/bottom 분할 없이 통짜로 렌더.
                 ⚠️ 앞/뒤는 DOM 순서가 아니라 z-index로 정함(캐릭터가 뒷모습(row===3)일 때 반전돼야
                 하기 때문 — CharacterMoving.vue의 같은 주석 참고) -->
            <div v-if="backDeco" class="oc-deco-viewport" :style="{ zIndex: backDecoZIndex }">
                <img class="oc-deco-sprite" :src="backDeco" :style="decoImgStyle" />
            </div>
            <div v-if="frontDeco" class="oc-deco-viewport" :style="{ zIndex: frontDecoZIndex }">
                <img class="oc-deco-sprite" :src="frontDeco" :style="decoImgStyle" />
            </div>
            <!-- 뒷머리 — CharacterMoving.vue와 동일한 이유/방식(정면에서만 몸통 뒤에 보임) -->
            <div v-if="backHair" class="oc-back-hair-viewport" :style="{ display: frame.row === 0 ? 'block' : 'none' }">
                <img class="oc-back-hair-sprite" :src="backHair" :style="backHairImgStyle" />
            </div>
            <!-- CharacterMoving.vue와 같은 이유로 상/하 슬라이스 분할(줌아웃 시 압축 연출 의도)을
                 걷어내고 셀 전체(128px)를 통짜 한 장으로 렌더함 -->
            <div class="oc-slice">
                <img
                    v-for="layer in layers"
                    :key="layer"
                    class="oc-sprite"
                    :src="layer"
                    :style="imgStyle"
                />
            </div>
        </div>
        <span class="other-user-name" @click.stop="$emit('avatar-click', $event)">{{ name }}</span>
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
    // 데코(useCharacter.ts getCharacterLayers가 계산해서 넘겨줌) — 한 번에 최대 하나만 장착되므로
    // 앞/뒤 중 실제로 있는 쪽 하나만 채워져 있고 나머진 null
    backDeco: { type: String, default: null },
    frontDeco: { type: String, default: null },
    // 뒷머리(useCharacter.ts getCharacterLayers가 hair와 같은 파일을 그대로 내려줌) — 정면에서만 보임
    backHair: { type: String, default: null },
})

// 아바타 몸통/닉네임을 클릭하면 부모(RoomMap.vue)에 알려서 프로필 카드를 띄우게 함 — userId만
// 갖고 있어서(전체 유저 데이터는 부모 쪽 otherUsersInRoom에 있음) 실제 카드 오픈은 부모가 처리
defineEmits(['avatar-click'])

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

// 현재 프레임 (reactive로 관리 → computed style로 연결)
const frame = ref({ row: 0, col: 1 })

const imgStyle = computed(() =>
    `top:${-128 * frame.value.row}px; left:${-128 * frame.value.col}px;`)

// 데코는 몸통과 셀 높이가 달라서(178 vs 128) 자기만의 top 계산을 씀 — col은 몸통과 동일
const decoImgStyle = computed(() =>
    `top:${-178 * frame.value.row}px; left:${-128 * frame.value.col}px;`)

// 뒷머리 — row는 항상 3(뒷모습 프레임, 시트의 마지막 줄) 고정, col만 앞머리와 맞춰서 같이 흔들리게 함
const backHairImgStyle = computed(() =>
    `top:${-128 * 3}px; left:${-128 * frame.value.col}px;`)

// row===3(KeyW, 뒷모습)일 때만 앞/뒤 데코의 z-index를 서로 바꿈 — 템플릿 주석 참고
const isBackView = computed(() => frame.value.row === 3)
const backDecoZIndex = computed(() => isBackView.value ? 1 : -1)
const frontDecoZIndex = computed(() => isBackView.value ? -1 : 1)

let animInterval = null
// 멈췄을 때(direction이 null) 기본값(아래를 보는 row 0)으로 되돌리는 대신, 마지막으로 걷던
// 방향을 그대로 보고 서 있게 하기 위해 따로 기억해둠 — CharacterMoving.vue(내 캐릭터)와 동일한 처리
let lastRow = 0
// 방에 이미 들어와 있던(멈춰 서 있는) 유저를 나중에 합류해서 처음 보는 경우 — props.direction이
// mount 시점부터 이미 값을 갖고 있는데, watch는 기본적으로 "이후에 바뀔 때"만 반응하고 처음
// 값에는 반응하지 않아서 이 방향을 놓치고 계속 기본 자세(아래)로 보였음. immediate:true로 첫
// 값도 반영하되, 첫 실행에는 "지금 막 걷기 시작한 것"처럼 걷기 애니메이션을 새로 트는 대신
// 정지 자세로만 세팅함 — 실제로 걷는 중이면 뒤이어 곧 오는 실시간 position이 자연스럽게
// 걷는 애니메이션으로 바꿔줌
let firstRun = true

watch(() => props.direction, (dir) => {
    if (animInterval) { clearInterval(animInterval); animInterval = null }
    if (dir && FRAMES[dir]) lastRow = FRAMES[dir][0].row

    if (firstRun) {
        firstRun = false
        frame.value = { row: lastRow, col: 1 }
        return
    }

    if (!dir || !FRAMES[dir]) {
        frame.value = { row: lastRow, col: 1 }
        return
    }
    let idx = 0
    animInterval = setInterval(() => {
        frame.value = FRAMES[dir][idx]
        idx = (idx + 1) % 4
    }, 150)
}, { immediate: true })

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
    /* .oc-wrapper가 pointer-events:none이라(맵 클릭을 가리지 않으려고) 기본적으로는 자손도 다
       클릭이 안 먹음 — 프로필 카드를 띄우는 몸통/닉네임만 명시적으로 다시 켜줌 */
    pointer-events: auto;
    cursor: pointer;
}

/* @keyframes jump-hop은 CharacterMoving.vue에 정의돼 있음 — 이 파일도 전역 스타일로 번들되니
   그대로 재사용(같은 페이지에 항상 같이 로드되는 컴포넌트라 안전함) */
.jump-anim .oc-body {
    animation: jump-hop 0.4s linear;
}

.oc-slice {
    height: 128px;
    width: 128px;
    overflow: hidden;
    position: relative;
}

.oc-sprite {
    position: absolute;
    width: 384px;
    height: 512px;
    top: 0;
    left: -128px;
}

/* 데코 — CharacterMoving.vue의 .char-deco-viewport/.char-deco-sprite와 동일한 치수/이유 */
.oc-deco-viewport {
    position: absolute;
    top: -50px;
    left: 0;
    width: 128px;
    height: 178px;
    overflow: hidden;
    pointer-events: none;
}

.oc-deco-sprite {
    position: absolute;
    width: 384px;
    height: 712px;
    top: 0;
    left: -128px;
}

/* 뒷머리 — CharacterMoving.vue의 .char-back-hair-viewport/.char-back-hair-sprite와 동일한 이유/치수 */
.oc-back-hair-viewport {
    position: absolute;
    top: 0;
    left: 0;
    width: 128px;
    height: 128px;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
}

.oc-back-hair-sprite {
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
