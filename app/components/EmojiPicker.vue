<template>
    <Teleport to="body">
        <div class="emoji-picker-popover" :style="popoverStyle">
            <emoji-picker
                v-if="ready"
                ref="pickerEl"
                class="ep-native"
                locale="ko"
                data-source="/emoji-data/ko.json"
            ></emoji-picker>
            <div v-else class="emoji-picker-loading">불러오는 중...</div>
        </div>
    </Teleport>
</template>

<script setup>
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
    const left = Math.min(rect.left, window.innerWidth - 328)
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
    --indicator-color: var(--accent);
    --input-border-color: rgba(var(--fg-rgb), 0.15);
    --input-font-color: rgba(var(--fg-rgb), 0.85);
    --input-placeholder-color: rgba(var(--fg-rgb), 0.3);
    --outline-color: var(--accent);
    width: 320px;
    max-width: 88vw;
    height: 360px;
    border-radius: 12px;
    box-shadow: var(--modal-shadow);
    font-family: inherit;
}

.emoji-picker-loading {
    width: 320px;
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
</style>
