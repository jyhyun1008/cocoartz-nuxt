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
            <div v-if="activeTab === 'custom'" class="ep-custom-panel">
                <input
                    v-model="customSearch"
                    type="text"
                    class="ep-custom-search"
                    placeholder="이모지 검색 (샷코드·태그)"
                />
                <div v-if="customEmojiCategories.length" class="ep-custom-categories">
                    <button
                        class="ep-cat-chip"
                        :class="{ active: customActiveCategory === 'all' }"
                        @click="customActiveCategory = 'all'"
                    >전체</button>
                    <button
                        v-for="c in customEmojiCategories"
                        :key="c"
                        class="ep-cat-chip"
                        :class="{ active: customActiveCategory === c }"
                        @click="customActiveCategory = c"
                    >{{ c }}</button>
                </div>
                <div class="ep-custom-grid">
                    <button
                        v-for="e in filteredCustomEmojiList"
                        :key="e.shortcode"
                        class="ep-custom-item"
                        :title="`:${e.shortcode}:`"
                        @click="handleCustomEmojiClick(e)"
                    >
                        <img :src="e.imageUrl" :alt="`:${e.shortcode}:`" loading="lazy" />
                    </button>
                    <div v-if="!filteredCustomEmojiList.length" class="ep-custom-empty">검색 결과가 없어요</div>
                </div>
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
const { list: customEmojiList, categories: customEmojiCategories, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
const activeTab = ref('unicode')
function handleCustomEmojiClick(e) {
    emit('select', `:${e.shortcode}:`)
}

// 커스텀 이모지가 많아지면 유니코드 탭처럼 검색/분류가 필요해져서 추가 — 관리자가 설정에서
// 채워둔 category(칩 하나)/tags(한국어 키워드, 공백 구분)를 그대로 씀. 둘 다 비워둔 이모지는
// "전체"에서만 보임(특정 카테고리 칩으로는 안 걸러짐)
const customSearch = ref('')
const customActiveCategory = ref('all')
const filteredCustomEmojiList = computed(() => {
    const q = customSearch.value.trim().toLowerCase()
    return customEmojiList.value.filter((e) => {
        if (customActiveCategory.value !== 'all' && e.category !== customActiveCategory.value) return false
        if (!q) return true
        return e.shortcode.toLowerCase().includes(q) || (e.tags ?? '').toLowerCase().includes(q)
    })
})

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
/* 예전엔 탭 버튼/검색창/칩/그리드가 각자 따로 배경을 갖고 6px씩 떨어져 있어서, 그 틈새로
   뒤(지도/채팅)가 그대로 비쳐 보여 전체적으로 "투명한 피커"처럼 보였음 — 이제 팝오버 자체를
   하나의 불투명 카드로 만들고 안쪽 요소들은 그 카드 위에 얹히는 식으로 바꿈 */
.emoji-picker-popover {
    z-index: 99999;
    width: 360px;
    max-width: 88vw;
    box-sizing: border-box;
    padding: 8px;
    background: var(--surface-2);
    border-radius: 14px;
    box-shadow: var(--modal-shadow);
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    width: 100%;
    height: 360px;
    border-radius: 10px;
    font-family: inherit;
}

.emoji-picker-loading {
    width: 100%;
    height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--fg-rgb), 0.4);
    font-size: 0.85rem;
}

.ep-tabs {
    display: flex;
    gap: 4px;
    width: 100%;
}

.ep-tab-btn {
    flex: 1;
    padding: 6px 0;
    border: none;
    border-radius: 8px;
    background: rgba(var(--fg-rgb), 0.06);
    color: rgba(var(--fg-rgb), 0.5);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}
.ep-tab-btn.active {
    background: var(--accent);
    color: rgba(var(--accent-fg-rgb), 1);
}

.ep-custom-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ep-custom-search {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(var(--fg-rgb), 0.15);
    background: rgba(var(--fg-rgb), 0.06);
    color: rgba(var(--fg-rgb), 0.85);
    font-size: 0.82rem;
    font-family: inherit;
}
.ep-custom-search::placeholder { color: rgba(var(--fg-rgb), 0.3); }
.ep-custom-search:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

.ep-custom-categories {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 2px;
}
.ep-custom-categories::-webkit-scrollbar { height: 0; }

.ep-cat-chip {
    flex: none;
    padding: 4px 10px;
    border: none;
    border-radius: 999px;
    background: rgba(var(--fg-rgb), 0.08);
    color: rgba(var(--fg-rgb), 0.55);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}
.ep-cat-chip.active {
    background: var(--accent);
    color: rgba(var(--accent-fg-rgb), 1);
}

.ep-custom-grid {
    width: 100%;
    height: 290px;
    overflow-y: auto;
    display: grid;
    /* emoji-picker-element 기본 셀 크기(--emoji-size:1.375rem + --emoji-padding:0.5rem*2 =
       38px)와 맞춰서 유니코드 탭과 똑같이 작게 보이게 함 — 칸 너비를 퍼센트가 아니라 고정
       px로 줘야 커스텀 탭에서도 그 크기가 유지됨 */
    grid-template-columns: repeat(auto-fill, 38px);
    justify-content: space-between;
    /* 기본값(auto + 그리드의 align-content:stretch)이면 항목이 한 줄뿐일 때 그 한 줄이
       컨테이너 높이 전체로 늘어나면서 이모지가 대빵 커져버림 — 줄 높이를 열 너비에
       맞춰 고정하고, 남는 세로 공간은 늘리지 말고 위에서부터만 채우게 함 */
    grid-auto-rows: 38px;
    align-content: start;
    row-gap: 2px;
    box-sizing: border-box;
}

.ep-custom-empty {
    grid-column: 1 / -1;
    padding: 34px 0;
    text-align: center;
    font-size: 0.8rem;
    color: rgba(var(--fg-rgb), 0.35);
}

.ep-custom-item {
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 100%;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 7px;
    box-sizing: border-box;
}
.ep-custom-item:hover { background: rgba(var(--fg-rgb), 0.08); }
.ep-custom-item img { width: 100%; height: 100%; object-fit: contain; }
</style>
