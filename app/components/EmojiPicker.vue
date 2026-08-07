<template>
    <Teleport to="body">
        <div class="emoji-picker-popover" :style="popoverStyle">
            <div v-if="customEmojiList.length" class="ep-tabs">
                <button class="ep-tab-btn" :class="{ active: activeTab === 'unicode' }" @click="activeTab = 'unicode'">유니코드</button>
                <button class="ep-tab-btn" :class="{ active: activeTab === 'custom' }" @click="activeTab = 'custom'">커스텀</button>
            </div>
            <emoji-picker
                v-if="ready"
                v-show="activeTab === 'unicode'"
                ref="pickerEl"
                class="ep-native"
                locale="ko"
                data-source="/emoji-data/ko.json"
                emoji-version="17.0"
            ></emoji-picker>
            <div v-else-if="activeTab === 'unicode'" class="emoji-picker-loading">불러오는 중...</div>
            <div v-if="activeTab === 'custom'" class="ep-custom-grid">
                <button
                    v-for="e in customEmojiList"
                    :key="e.shortcode"
                    class="ep-custom-item"
                    :title="`:${e.shortcode}:`"
                    @click="handleCustomEmojiClick(e)"
                >
                    <img :src="e.imageUrl" :alt="`:${e.shortcode}:`" loading="lazy" />
                </button>
            </div>
        </div>
    </Teleport>
</template>

<script setup>
// 실제 게시글/댓글/리액션에 쓰이는 이모지는 twemoji.client.ts가 렌더링 시점에 Twemoji 이미지로
// 바꿔주지만, emoji-picker-element는 Shadow DOM 안에서 자체적으로 그리기 때문에 그 방식이 안 닿음.
// 그래서 피커 자체도 OS 기본 이모지 폰트 대신 Twemoji COLR 폰트로 그리도록 --emoji-font-family로 지정.
import '@sableclient/twemoji-font'

// 우리 서버 커스텀 이모지 — 목록이 있을 때만 "커스텀" 탭을 보여줌. 클릭하면 유니코드 이모지와
// 동일한 select 이벤트를 :shortcode: 문자열로 emit해서, 텍스트 삽입/리액션 쪽 소비 코드를
// 전혀 손대지 않아도 그대로 동작하게 함
const { list: customEmojiList, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
const activeTab = ref('unicode')
function handleCustomEmojiClick(e) {
    emit('select', `:${e.shortcode}:`)
}

// 프리셋 몇 개가 아니라 유니코드 이모지 전체 중 아무거나 고를 수 있는 피커.
// emoji-picker-element는 DOM 커스텀 엘리먼트라 서버에선 등록이 안 되므로 mounted 이후에만 렌더링함.
// body로 teleport하는 이유: 채팅 작은창/모달처럼 backdrop-filter가 걸린 조상 안에 있으면
// 그 안에서 새 stacking context가 생겨서 z-index를 아무리 올려도 캐릭터 레이어(z-index 9999대)
// 같은 바깥 형제 요소에 클릭이 가로막히는 문제가 있었음 — teleport로 아예 벗어나야 함
const props = defineProps({
    placement: { type: String, default: 'top' }, // 트리거 기준 위/아래 어느 쪽으로 펼칠지
    anchor: { type: [Object, Function], default: null }, // 트리거 버튼의 template ref
})
const emit = defineEmits(['select'])
const ready = ref(false)
const pickerEl = ref(null)
const popoverStyle = ref({ position: 'fixed', visibility: 'hidden' })

function getAnchorEl() {
    // 템플릿에서 넘어온 ref는 이미 언래핑된 DOM 엘리먼트인 경우가 대부분인데,
    // <button>은 폼 value 프로퍼티가 기본으로 존재해서 'value' in a 로는 구분이 안 됨
    const a = props.anchor
    if (!a) return null
    if (a instanceof HTMLElement) return a
    return a.value ?? null
}

function computePosition() {
    const el = getAnchorEl()
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 368)
    if (props.placement === 'top') {
        popoverStyle.value = {
            position: 'fixed',
            left: `${Math.max(8, left)}px`,
            bottom: `${window.innerHeight - rect.top + 6}px`,
        }
    } else {
        popoverStyle.value = {
            position: 'fixed',
            left: `${Math.max(8, left)}px`,
            top: `${rect.bottom + 6}px`,
        }
    }
}

function handleEmojiClick(e) {
    emit('select', e.detail.unicode)
}

function handleReposition() {
    computePosition()
}

onMounted(async () => {
    ensureCustomEmojisLoaded()
    computePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    await import('emoji-picker-element')
    ready.value = true
    await nextTick()
    computePosition()
    pickerEl.value?.addEventListener('emoji-click', handleEmojiClick)
})

onBeforeUnmount(() => {
    pickerEl.value?.removeEventListener('emoji-click', handleEmojiClick)
    window.removeEventListener('resize', handleReposition)
    window.removeEventListener('scroll', handleReposition, true)
})
</script>

<style>
.emoji-picker-popover {
    z-index: 99999;
}

emoji-picker {
    --background: var(--surface-2);
    --border-color: rgba(var(--fg-rgb), 0.1);
    --button-active-background: rgba(var(--fg-rgb), 0.12);
    --button-hover-background: rgba(var(--fg-rgb), 0.08);
    --category-font-color: rgba(var(--fg-rgb), 0.9);
    --emoji-font-family: Twemoji;
    --indicator-color: var(--accent);
    --input-border-color: rgba(var(--fg-rgb), 0.15);
    --input-font-color: rgba(var(--fg-rgb), 0.85);
    --input-placeholder-color: rgba(var(--fg-rgb), 0.3);
    --outline-color: var(--accent);
    width: 360px;
    max-width: 88vw;
    height: 360px;
    border-radius: 12px;
    box-shadow: var(--modal-shadow);
    font-family: inherit;
}

.emoji-picker-loading {
    width: 360px;
    max-width: 88vw;
    height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    border-radius: 12px;
    box-shadow: var(--modal-shadow);
    color: rgba(var(--fg-rgb), 0.4);
    font-size: 0.85rem;
}

.ep-tabs {
    display: flex;
    gap: 4px;
    width: 360px;
    max-width: 88vw;
    margin-bottom: 6px;
}

.ep-tab-btn {
    flex: 1;
    padding: 6px 0;
    border: none;
    border-radius: 8px;
    background: var(--surface-2);
    color: rgba(var(--fg-rgb), 0.5);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--modal-shadow);
}
.ep-tab-btn.active {
    background: var(--accent);
    color: rgba(var(--accent-fg-rgb), 1);
}

.ep-custom-grid {
    width: 360px;
    max-width: 88vw;
    height: 360px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    padding: 10px;
    background: var(--surface-2);
    border-radius: 12px;
    box-shadow: var(--modal-shadow);
    box-sizing: border-box;
}

.ep-custom-item {
    aspect-ratio: 1;
    border: none;
    border-radius: 8px;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 4px;
}
.ep-custom-item:hover { background: rgba(var(--fg-rgb), 0.08); }
.ep-custom-item img { width: 100%; height: 100%; object-fit: contain; }
</style>
