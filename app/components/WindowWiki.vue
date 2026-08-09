<template>
    <div class="modal-base">

        <!-- 헤더 -->
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-book-open-01"></i>
            <span class="wiki-header-title">
                <span v-if="currentView === 'create'">새 페이지 작성</span>
                <span v-else-if="currentView === 'edit'">페이지 편집</span>
                <span v-else-if="currentView === 'history'">편집 이력</span>
                <span v-else>{{ props.roomName || '위키' }}</span>
            </span>
            <div class="wiki-header-actions">
                <!-- 목록 뷰 -->
                <template v-if="currentView === 'list'">
                    <button v-if="isLoggedIn" class="write-btn-header" @click="startCreate">+ 새 페이지</button>
                </template>
                <!-- 상세 뷰 -->
                <template v-else-if="currentView === 'detail'">
                    <button v-if="isLoggedIn" class="write-btn-header" @click="startEdit">편집</button>
                    <button class="back-btn-header" @click="currentView = 'history'">이력</button>
                    <button class="back-btn-header" @click="goToList">목록</button>
                </template>
                <!-- 작성/편집/이력 뷰 -->
                <template v-else>
                    <button class="back-btn-header" @click="goBack">← 뒤로</button>
                    <button class="back-btn-header" @click="goToList">목록</button>
                </template>
                <button class="window-close-btn wiki-close-btn" @click="$emit('close')">✕</button>
            </div>
        </div>

        <!-- 목록 -->
        <div v-if="currentView === 'list'" id="wiki-wrapper">
            <div v-if="pages.length" class="wiki-list">
                <div
                    v-for="page in pages"
                    :key="page.id"
                    class="wiki-list-item"
                    @click="navigateTo(`${channelPath}/${encodeURIComponent(page.slug)}`)"
                >
                    <div class="wiki-list-title">
                        <i class="hgi hgi-stroke hgi-file-01 wiki-file-icon"></i>
                        <span>{{ page.title }}</span>
                    </div>
                    <div class="wiki-list-meta">
                        <span class="wiki-author">{{ page.editor?.knownas ?? page.editor?.username ?? page.author?.knownas ?? page.author?.username }}</span>
                        <span class="datetime">{{ formatDate(page.updatedAt) }}</span>
                    </div>
                </div>
            </div>
            <div v-else class="empty">
                <i class="hgi hgi-stroke hgi-book-open-01" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:8px;"></i>
                아직 위키 페이지가 없습니다.<br />
                <span v-if="isLoggedIn" style="font-size:0.82rem;opacity:0.5">첫 번째 페이지를 작성해 보세요!</span>
                <span v-else style="font-size:0.82rem;opacity:0.5">로그인 후 페이지를 작성할 수 있습니다.</span>
            </div>
        </div>

        <!-- 페이지 보기 -->
        <div v-else-if="currentView === 'detail' && currentPage" id="wiki-wrapper">
            <div class="wiki-detail">
                <div class="post-title-large">{{ currentPage.title }}</div>
                <div class="wiki-meta">
                    <NuxtLink
                        :to="currentPage.author?.username ? `/@${currentPage.author.username}` : '#'"
                        class="post-author user-name-link"
                    >{{ currentPage.author?.knownas ?? currentPage.author?.username }}</NuxtLink>
                    <span class="datetime">작성 {{ formatDate(currentPage.createdAt) }}</span>
                    <template v-if="currentPage.editorid">
                        <span class="datetime">·</span>
                        <NuxtLink
                            :to="currentPage.editor?.username ? `/@${currentPage.editor.username}` : '#'"
                            class="post-author user-name-link"
                        >{{ currentPage.editor?.knownas ?? currentPage.editor?.username }}</NuxtLink>
                        <span class="datetime">편집 {{ formatDate(currentPage.updatedAt) }}</span>
                    </template>
                    <div class="wiki-meta-actions">
                        <div class="share-btn-wrap">
                            <button class="post-icon-btn" @click="shareWikiPage" title="공유">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="18" cy="5" r="3" />
                                    <circle cx="6" cy="12" r="3" />
                                    <circle cx="18" cy="19" r="3" />
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                            </button>
                            <span v-if="shareCopied" class="share-toast">링크 복사됨</span>
                        </div>
                    </div>
                </div>
                <div class="wiki-content" v-html="renderedContent"></div>
            </div>
        </div>

        <!-- 편집 이력 -->
        <div v-else-if="currentView === 'history' && currentPage" id="wiki-wrapper">
            <div v-if="currentPage.history?.length" class="wiki-history">
                <div v-for="(rev, i) in [...currentPage.history].reverse()" :key="i" class="history-item">
                    <div class="history-meta">
                        <span class="datetime">{{ formatDate(rev.editedAt) }}</span>
                        <span class="post-author">이전 버전 #{{ currentPage.history.length - i }}</span>
                    </div>
                    <div class="history-title">{{ rev.title }}</div>
                    <div class="history-preview">{{ rev.content.slice(0, 120) }}{{ rev.content.length > 120 ? '…' : '' }}</div>
                </div>
            </div>
            <div v-else class="empty">편집 이력이 없습니다.</div>
        </div>

        <!-- 작성 / 편집 폼 -->
        <div v-else-if="currentView === 'create' || currentView === 'edit'" id="wiki-wrapper">
            <div class="create-form">
                <input v-model="editTitle" placeholder="페이지 제목" class="post-input" />
                <div class="editor-tabs">
                    <button class="editor-tab-btn" :class="{ active: editorTab === 'write' }" @click="editorTab = 'write'">작성</button>
                    <button class="editor-tab-btn" :class="{ active: editorTab === 'preview' }" @click="editorTab = 'preview'">미리보기</button>
                </div>
                <template v-if="editorTab === 'write'">
                    <div class="wiki-toolbar">
                        <button class="toolbar-btn" @click="insertMarkdown('**', '**')"><b>B</b></button>
                        <button class="toolbar-btn" @click="insertMarkdown('*', '*')"><i>I</i></button>
                        <button class="toolbar-btn" @click="insertMarkdown('## ', '')">H</button>
                        <button class="toolbar-btn" @click="insertMarkdown('- ', '')">•</button>
                        <button class="toolbar-btn" @click="insertMarkdown('[링크](', ')')" title="링크"><i class="hgi hgi-stroke hgi-link-01"></i></button>
                        <div class="toolbar-emoji-wrap" ref="emojiWrapRef">
                            <button ref="emojiBtnRef" class="toolbar-btn" @click.stop="showEmojiPicker = !showEmojiPicker" title="이모지">
                                <i class="hgi hgi-stroke hgi-smile"></i>
                            </button>
                            <EmojiPicker
                                v-if="showEmojiPicker"
                                placement="bottom"
                                :anchor="emojiBtnRef"
                                @select="(e) => { insertMarkdown(e, ''); showEmojiPicker = false }"
                            />
                        </div>
                        <span class="toolbar-sep"></span>
                        <span class="toolbar-hint">마크다운 지원</span>
                    </div>
                    <textarea
                        ref="editorRef"
                        v-model="editContent"
                        placeholder="내용을 입력하세요... (마크다운 사용 가능)"
                        class="post-textarea wiki-textarea"
                    ></textarea>
                </template>
                <div v-else class="wiki-content preview-pane" v-html="editPreviewContent"></div>
                <div class="wiki-form-actions">
                    <button class="submit-btn" @click="submitPage" :disabled="!editTitle.trim() || !editContent.trim()">
                        {{ currentView === 'create' ? '페이지 생성' : '변경사항 저장' }}
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { marked } from 'marked'
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const route = useRoute()
defineEmits(['close'])

const props = defineProps({
    ids: {
        type: Object,
        default: () => ({ serverid: 0, roomid: 0 }),
    },
    channelPath: { type: String, default: '/wiki' },
    targetSlug: { type: String, default: '' },
    roomName: { type: String, default: '' },
})

const { userId, isLoggedIn } = useCurrentUser()

// 우리 서버 커스텀 이모지(:shortcode:) — 위키 본문/미리보기 표시 시점에 치환
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()

const wikiKey = computed(() => `wiki-data-${route.params.page ?? 'default'}`)
const { data: pagesData, refresh: refreshPages } = await useAsyncData(
    wikiKey,
    () => $fetch(`${apiBaseUrl}/api/getWikiPages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomid: props.ids.roomid }),
    }).then(res => (Array.isArray(res) ? res : [])),
    { watch: [() => route.params.page] }
)

const pages = computed(() => pagesData.value ?? [])

const currentView = ref('list')
const currentPage = ref(null)

const shareCopied = ref(false)
async function shareWikiPage() {
    if (!currentPage.value) return
    await navigator.clipboard.writeText(`${window.location.origin}${props.channelPath}/${encodeURIComponent(currentPage.value.slug)}`)
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 1500)
}

// 목록으로 돌아갈 때 currentView만 바꾸고 URL은 그대로 두면(/wiki/환영합니다에 계속 머무름),
// 목록에서 방금 보던 페이지와 "같은" 제목을 다시 눌러도 navigateTo가 이미 그 URL이라 아무 일도
// 안 하고 넘어가버려서(경로가 실제로 안 바뀌니 targetSlug watch가 안 켜짐) 본문으로 못 돌아오는
// 버그가 있었음 — 목록으로 갈 때도 항상 URL을 채널 루트로 같이 옮겨서, 목록에서 아무 제목이나
// 눌러도 항상 "진짜 경로 변경"이 되게 함.
//
// ⚠️ 근데 채널 루트(슬러그 없음)는 [page]/index.vue가 매핑돼서(상세 보기는 [page]/[slug].vue) 이
// 컴포넌트 자체가 새로 마운트됨 — 그러면 "슬러그 없이 들어왔을 때는 대문 페이지를 자동으로 보여줌"
// 로직(아래 pages watch)이 같이 켜져서 목록 대신 대문 페이지가 뜨고, 거기서 목록을 한 번 더
// 눌러야 하는 문제가 있었음. "슬러그가 그냥 없는 것"과 "목록을 명시적으로 요청한 것"을 구분해야
// 해서 쿼리스트링(?view=list)을 붙임 — 대문 페이지 자동 표시 로직은 이게 있으면 건너뜀.
function goToList() {
    currentView.value = 'list'
    navigateTo({ path: props.channelPath, query: { view: 'list' } })
}

async function openPageBySlug(slug) {
    const data = await $fetch(`${apiBaseUrl}/api/getWikiPageBySlug`, {
        method: 'POST',
        body: { slug, roomid: props.ids.roomid },
    })
    currentPage.value = data
    currentView.value = 'detail'
}

// roomid가 로드됐을 때 targetSlug 처리
watch(() => props.ids.roomid, async (roomid) => {
    if (!roomid || !props.targetSlug) return
    try { await openPageBySlug(props.targetSlug) } catch { /* 없는 페이지면 목록 유지 */ }
}, { immediate: true })

// targetSlug가 바뀔 때 (쿼리 파라미터 변경으로 SPA 내 이동)
watch(() => props.targetSlug, async (slug) => {
    if (!slug || !props.ids.roomid) return
    try { await openPageBySlug(slug) } catch {}
})

// targetSlug 없을 때: 대문 페이지(첫 생성 페이지) 자동 표시 — 단, ?view=list로 명시적으로 목록을
// 요청하고 들어온 경우(goToList 참고)는 건너뜀
watch(pages, async (newPages) => {
    if (currentView.value !== 'list' || !newPages.length || props.targetSlug) return
    if (route.query.view === 'list') return
    const frontId = [...newPages].sort((a, b) => a.id - b.id)[0].id
    try { await openPage(frontId) } catch { /* 목록 유지 */ }
}, { immediate: true })
const editTitle = ref('')
const editContent = ref('')
const editorTab = ref('write')
const editorRef = ref(null)
const showEmojiPicker = ref(false)
const emojiWrapRef = ref(null)
const emojiBtnRef = ref(null)

onMounted(() => {
    ensureCustomEmojisLoaded()
    document.addEventListener('click', (e) => {
        // 이모지 피커는 <body>로 teleport돼서 wrap의 DOM 자손이 아니므로 따로 예외 처리해야 함
        if (e.target.closest('.emoji-picker-popover')) return
        if (emojiWrapRef.value && !emojiWrapRef.value.contains(e.target))
            showEmojiPicker.value = false
    })
})


function toSlug(title) {
    return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '')
}

// [[문서명]] → 문서명 그대로 표시하며 링크. [[문서명|표시할 텍스트]] → 표시할 텍스트로 보이되
// 링크는 문서명 쪽으로 감(예: [[설치 가이드|이곳을 참조해주세요]])
function preprocessWikiLinks(content) {
    return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
        const targetTrimmed = target.trim()
        const displayText = (label ?? target).trim()
        const slug = toSlug(targetTrimmed)
        const href = `${props.channelPath}/${encodeURIComponent(slug)}`
        return `<a href="${href}" class="wiki-internal-link">${displayText}</a>`
    })
}

const renderedContent = computed(() => {
    if (!currentPage.value?.content) return ''
    return renderCustomEmojiText(String(marked.parse(preprocessWikiLinks(currentPage.value.content), { breaks: true })), customEmojiMap.value)
})

// 작성/편집 중 미리보기 탭 — 실제 렌더링(renderedContent)과 같은 파이프라인(위키 내부링크 처리 포함)을 씀
const editPreviewContent = computed(() =>
    renderCustomEmojiText(String(marked.parse(preprocessWikiLinks(editContent.value.trim() || '_미리볼 내용이 없습니다._'), { breaks: true })), customEmojiMap.value),
)

async function openPage(id) {
    const data = await $fetch(`${apiBaseUrl}/api/getWikiPage`, {
        method: 'POST',
        body: { id },
    })
    currentPage.value = data
    currentView.value = 'detail'
}

function startCreate() {
    editTitle.value = ''
    editContent.value = ''
    editorTab.value = 'write'
    currentView.value = 'create'
}

function startEdit() {
    editTitle.value = currentPage.value.title
    editContent.value = currentPage.value.content
    editorTab.value = 'write'
    currentView.value = 'edit'
}

function goBack() {
    if (currentView.value === 'history' || currentView.value === 'edit') {
        currentView.value = 'detail'
    } else {
        goToList()
    }
}

function insertMarkdown(before, after) {
    const el = editorRef.value
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = editContent.value.slice(start, end)
    editContent.value = editContent.value.slice(0, start) + before + selected + after + editContent.value.slice(end)
    nextTick(() => {
        el.focus()
        el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
}

async function submitPage() {
    if (!editTitle.value.trim() || !editContent.value.trim()) return
    if (currentView.value === 'create') {
        const page = await $fetch(`${apiBaseUrl}/api/createWikiPage`, {
            method: 'POST',
            body: {
                ...props.ids,
                userid: userId.value,
                title: editTitle.value.trim(),
                content: editContent.value.trim(),
            },
        })
        await refreshPages()
        currentPage.value = page
        currentView.value = 'detail'
    } else {
        const page = await $fetch(`${apiBaseUrl}/api/updateWikiPage`, {
            method: 'POST',
            body: {
                id: currentPage.value.id,
                userid: userId.value,
                title: editTitle.value.trim(),
                content: editContent.value.trim(),
            },
        })
        await refreshPages()
        currentPage.value = page
        currentView.value = 'detail'
    }
}

</script>

<style>
.wiki-header-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.wiki-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.wiki-close-btn {
    margin-left: 0 !important;
}

#wiki-wrapper {
    padding: 20px 24px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.95rem;
}

/* 목록 */
.wiki-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.wiki-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.07);
    gap: 12px;
}

.wiki-list-item:hover { background: rgba(var(--fg-rgb),0.05); }

.wiki-list-title {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    flex: 1;
}

.wiki-list-title span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.wiki-file-icon {
    color: rgba(var(--fg-rgb),0.3);
    font-size: 0.9rem;
    flex-shrink: 0;
}

.wiki-list-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    font-size: 0.8rem;
}

/* 상세 페이지 */
.wiki-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.post-title-large {
    font-size: 1.3rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.92);
    line-height: 1.4;
}

.wiki-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.08);
    font-size: 0.85rem;
}

.wiki-content {
    line-height: 1.85;
    color: rgba(var(--fg-rgb),0.82);
    font-size: 0.95rem;
    overflow-wrap: break-word;
    word-break: break-word;
}

.wiki-content h1 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 16px 0 8px;
    color: rgba(var(--fg-rgb),1);
    border-bottom: 1px solid rgba(var(--fg-rgb),0.1);
    padding-bottom: 6px;
}

.wiki-content h2 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 14px 0 6px;
    color: rgba(var(--fg-rgb),0.92);
}

.wiki-content h3 {
    font-size: 1rem;
    font-weight: 700;
    margin: 10px 0 4px;
    color: rgba(var(--fg-rgb),0.85);
}

.wiki-content strong { color: rgba(var(--fg-rgb),1); }

.wiki-content a {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(210,31,60,0.4);
}

.wiki-content a.wiki-internal-link {
    color: var(--accent);
    text-decoration-color: rgba(210, 31, 60, 0.4);
}

.wiki-content ul {
    padding-left: 20px;
    margin: 6px 0;
}

.wiki-content li { margin: 2px 0; }

.wiki-meta-actions {
    display: flex;
    margin-left: auto;
}

.post-icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    border-radius: 6px;
    color: rgba(var(--fg-rgb),0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
}
.post-icon-btn:hover { background: rgba(var(--fg-rgb),0.08); color: rgba(var(--fg-rgb),0.8); }

.share-btn-wrap { position: relative; display: flex; }

.share-toast {
    position: absolute;
    bottom: 130%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 0.72rem;
    white-space: nowrap;
    pointer-events: none;
    animation: share-toast-fade 1.5s ease forwards;
}

@keyframes share-toast-fade {
    0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
}

/* 편집 이력 */
.wiki-history {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.history-item {
    padding: 12px;
    border-radius: 8px;
    background: rgba(var(--fg-rgb),0.04);
    border: 1px solid rgba(var(--fg-rgb),0.07);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.history-meta {
    display: flex;
    gap: 10px;
    align-items: center;
}

.history-title {
    font-weight: 600;
    color: rgba(var(--fg-rgb),0.75);
    font-size: 0.9rem;
}

.history-preview {
    font-size: 0.82rem;
    color: rgba(var(--fg-rgb),0.35);
    white-space: pre-wrap;
    line-height: 1.5;
}

/* 편집 폼 */
.wiki-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(var(--fg-rgb),0.05);
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 8px 8px 0 0;
    border-bottom: none;
}

.toolbar-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    color: rgba(var(--fg-rgb),0.6);
    border-radius: 5px;
    font-size: 0.88rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
}

.toolbar-btn:hover {
    background: rgba(var(--fg-rgb),0.1);
    color: rgba(var(--fg-rgb),1);
}

.toolbar-sep {
    width: 1px;
    height: 18px;
    background: rgba(var(--fg-rgb),0.12);
    margin: 0 4px;
}

.toolbar-emoji-wrap {
    position: relative;
    display: flex;
}

.toolbar-hint {
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.25);
    margin-left: auto;
}

.wiki-textarea {
    border-radius: 0 0 8px 8px !important;
    min-height: 200px;
}

.wiki-form-actions {
    display: flex;
    justify-content: flex-end;
}
</style>
