<template>
    <div class="modal-base">

        <!-- 헤더 (뷰에 따라 변경) -->
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-grid"></i>
            <span v-if="currentView === 'list'" class="board-header-title">게시판</span>
            <span v-else-if="currentView === 'create'" class="board-header-title">새 글 작성</span>
            <span v-else-if="currentView === 'detail'" class="board-header-title">{{ currentPost?.title }}</span>
            <span v-else-if="currentView === 'remote-detail'" class="board-header-title">{{ currentRemotePost?.summary || stripHtml(currentRemotePost?.content) }}</span>
            <div class="board-header-actions">
                <button v-if="currentView === 'list'" class="write-btn-header" @click="currentView = 'create'">+ 새 글</button>
                <button v-else class="back-btn-header" @click="currentView = 'list'">← 목록</button>
                <button class="window-close-btn board-close-btn" @click="$emit('close')">✕</button>
            </div>
        </div>

        <!-- 목록 -->
        <div v-if="currentView === 'list'" id="board-wrapper">
            <div v-if="mergedFeed.length" class="board">
                <template v-for="entry in mergedFeed" :key="`${entry.kind}-${entry.post.id}`">
                    <!-- 로컬 글 -->
                    <div v-if="entry.kind === 'local'" class="post-card" @click="openPost(entry.post.id)">
                        <div class="post-card-title">{{ entry.post.title }}</div>
                        <div class="post-card-meta">
                            <NuxtLink :to="entry.post.user?.username ? `/@${entry.post.user.username}` : '#'" class="post-author user-name-link" @click.stop>{{ entry.post.user?.knownas ?? entry.post.user?.username }}</NuxtLink>
                            <span class="datetime">{{ formatDate(entry.post.createdAt) }}</span>
                        </div>
                    </div>
                    <!-- 연합 팔로잉 피드(외부) 글 -->
                    <div v-else class="post-card external-post-card" @click="openRemotePost(entry.post)">
                        <div class="post-card-title">
                            <i class="hgi hgi-stroke hgi-globe-02"></i>
                            <template v-if="entry.post.summary">
                                <i class="hgi hgi-stroke hgi-alert-02 cw-icon" title="열람주의(CW)"></i>
                                <span>{{ entry.post.summary }}</span>
                            </template>
                            <span v-else class="preview-text">{{ stripHtml(entry.post.content) }}</span>
                        </div>
                        <div class="post-card-meta">
                            <span class="post-author remote-handle">{{ entry.post.sourceName || entry.post.sourceHandle }}</span>
                            <span class="datetime">{{ formatDate(entry.post.published) }}</span>
                        </div>
                    </div>
                </template>
            </div>
            <div v-else class="empty">게시물이 없습니다.</div>
        </div>

        <!-- 글 작성 -->
        <div v-else-if="currentView === 'create'" id="board-wrapper">
            <div class="create-form">
                <input v-model="newTitle" placeholder="제목" class="post-input" />
                <textarea v-model="newContent" placeholder="내용을 입력하세요..." class="post-textarea"></textarea>
                <button class="submit-btn" @click="submitPost" :disabled="!newTitle.trim() || !newContent.trim()">작성 완료</button>
            </div>
        </div>

        <!-- 게시물 상세 -->
        <div v-else-if="currentView === 'detail' && currentPost" id="board-wrapper">
            <div class="post-detail">
                <div class="post-meta">
                    <NuxtLink :to="currentPost.user?.username ? `/@${currentPost.user.username}` : '#'" class="post-author user-name-link">{{ currentPost.user?.knownas ?? currentPost.user?.username }}</NuxtLink>
                    <span class="datetime">{{ formatDate(currentPost.createdAt) }}</span>
                    <button class="like-btn" :class="{ liked: currentPost.isLiked }" @click="toggleLike">
                        ♥ {{ currentPost.likeCount }}
                    </button>
                    <span v-if="currentPost.boostCount" class="boost-count" title="fediverse 부스트"><i class="hgi hgi-stroke hgi-arrow-reload-horizontal"></i> {{ currentPost.boostCount }}</span>
                </div>
                <div class="post-content md-content" v-html="String(marked.parse(currentPost.content ?? ''))"></div>

                <!-- 이모지 리액션 -->
                <div class="reactions-row">
                    <button
                        v-for="r in currentPost.reactions"
                        :key="r.emoji"
                        class="reaction-pill"
                        :class="{ reacted: r.reacted }"
                        @click="toggleReaction(r.emoji)"
                    >
                        {{ r.emoji }} {{ r.count }}
                    </button>
                    <div class="emoji-picker-wrap" ref="pickerWrapRef">
                        <button class="reaction-add-btn" @click.stop="showPicker = !showPicker">+</button>
                        <div v-if="showPicker" class="emoji-picker">
                            <button
                                v-for="e in EMOJI_PRESETS"
                                :key="e"
                                class="emoji-preset"
                                :class="{ reacted: currentPost.reactions?.some(r => r.emoji === e && r.reacted) }"
                                @click="toggleReaction(e); showPicker = false"
                            >{{ e }}</button>
                        </div>
                    </div>
                </div>

                <div class="comments-section">
                    <div class="comments-title">댓글 {{ currentPost.comments?.length ?? 0 }}</div>
                    <div v-for="comment in currentPost.comments" :key="comment.id" class="comment">
                        <div class="comment-meta">
                            <template v-if="comment.remoteActorHandle">
                                <a :href="comment.remoteActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author" title="fediverse에서 온 답글">
                                    <i class="hgi hgi-stroke hgi-globe-02"></i>
                                    {{ comment.remoteActorName || comment.remoteActorHandle }}
                                    <span class="remote-handle">{{ comment.remoteActorHandle }}</span>
                                </a>
                            </template>
                            <NuxtLink v-else :to="comment.user?.username ? `/@${comment.user.username}` : '#'" class="post-author user-name-link">{{ comment.user?.knownas ?? comment.user?.username }}</NuxtLink>
                            <span class="datetime">{{ formatDate(comment.createdAt) }}</span>
                        </div>
                        <div v-if="comment.remoteActorHandle" class="comment-body" v-html="comment.content"></div>
                        <div v-else class="comment-body">{{ comment.content }}</div>
                    </div>
                    <div class="empty" v-if="!currentPost.comments?.length">댓글이 없습니다.</div>
                </div>

                <div class="comment-form">
                    <input v-model="commentContent" placeholder="댓글 작성..." class="post-input" @keydown.enter="submitComment" />
                    <button class="submit-btn" @click="submitComment" :disabled="!commentContent.trim()">작성</button>
                </div>
            </div>
        </div>

        <!-- 연합 팔로잉 피드 글 상세 (원격) -->
        <div v-else-if="currentView === 'remote-detail' && currentRemotePost" id="board-wrapper">
            <div class="post-detail">
                <div class="post-meta">
                    <a :href="currentRemotePost.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author">
                        <i class="hgi hgi-stroke hgi-globe-02"></i>
                        {{ currentRemotePost.sourceName || currentRemotePost.sourceHandle }}
                        <span class="remote-handle">{{ currentRemotePost.sourceHandle }}</span>
                    </a>
                    <span class="datetime">{{ formatDate(currentRemotePost.published) }}</span>
                </div>

                <div v-if="currentRemotePost.summary && !showRemoteContent" class="remote-cw-gate">
                    <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> {{ currentRemotePost.summary }}</div>
                    <button class="submit-btn" @click="showRemoteContent = true">내용 보기</button>
                </div>
                <div v-else class="post-content md-content" v-html="currentRemotePost.content"></div>

                <a :href="currentRemotePost.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="remote-original-link">
                    원 계정에서 보기 <i class="hgi hgi-stroke hgi-arrow-up-right-01"></i>
                </a>
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
    isFederated: {
        type: Boolean,
        default: false,
    },
})

const { userId } = useCurrentUser()
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

const postKey = computed(() => `post-data-${route.params.page ?? 'default'}`)

const { data: postData, refresh: refreshPosts } = await useAsyncData(
    postKey,
    () => $fetch(`${apiBaseUrl}/api/getPostsByRoomId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(props.ids),
    }).then(res => (Array.isArray(res) ? res : [])),
    { watch: [() => route.params.page] }
)

const topLevelPosts = computed(() => (postData.value ?? []).filter(p => !p.replyto))

// 연합 게시판이면 내가 팔로우한 원격 계정의 글도 같이 섞어서 보여줌
const { data: remoteFeedData } = await useAsyncData(
    'board-remote-feed',
    () => (props.isFederated && userId.value)
        ? $fetch(`${apiBaseUrl}/api/getRemoteFeedPosts`, { method: 'POST', body: { userid: userId.value } }).then(res => (Array.isArray(res) ? res : []))
        : Promise.resolve([]),
    { watch: [() => props.isFederated, userId] }
)

function stripHtml(html) {
    return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const mergedFeed = computed(() => {
    const local = topLevelPosts.value.map(p => ({ kind: 'local', sortDate: p.createdAt, post: p }))
    if (!props.isFederated) return local
    const remote = (remoteFeedData.value ?? []).map(p => ({ kind: 'remote', sortDate: p.published, post: p }))
    return [...local, ...remote].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
})

const EMOJI_PRESETS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀', '✅', '💯', '🥰']

const currentView = ref('list')
const currentPost = ref(null)
const currentRemotePost = ref(null)
const showRemoteContent = ref(false)
const newTitle = ref('')
const newContent = ref('')
const commentContent = ref('')
const showPicker = ref(false)
const pickerWrapRef = ref(null)

function formatDate(str) {
    if (!str) return ''
    return str.split('T')[0] === today
        ? str.split('T')[1].slice(0, 5)
        : str.split('T')[0]
}

async function openPost(postid) {
    const data = await $fetch(`${apiBaseUrl}/api/getPostById`, {
        method: 'POST',
        body: { postid, userid: userId.value },
    })
    currentPost.value = data
    currentView.value = 'detail'
}

function openRemotePost(post) {
    currentRemotePost.value = post
    showRemoteContent.value = false
    currentView.value = 'remote-detail'
}

async function submitPost() {
    if (!newTitle.value.trim() || !newContent.value.trim()) return
    await $fetch(`${apiBaseUrl}/api/createPost`, {
        method: 'POST',
        body: {
            ...props.ids,
            userid: userId.value,
            title: newTitle.value.trim(),
            content: newContent.value.trim(),
        },
    })
    newTitle.value = ''
    newContent.value = ''
    await refreshPosts()
    currentView.value = 'list'
}

async function submitComment() {
    if (!commentContent.value.trim() || !currentPost.value) return
    const content = commentContent.value.trim()
    commentContent.value = ''
    await $fetch(`${apiBaseUrl}/api/createPost`, {
        method: 'POST',
        body: {
            ...props.ids,
            userid: userId.value,
            title: content.slice(0, 50),
            content,
            replyto: currentPost.value.id,
        },
    })
    await openPost(currentPost.value.id)
}

async function toggleReaction(emoji) {
    if (!currentPost.value) return
    const result = await $fetch(`${apiBaseUrl}/api/reactPost`, {
        method: 'POST',
        body: { postid: currentPost.value.id, userid: userId.value, emoji },
    })
    const existing = currentPost.value.reactions?.find(r => r.emoji === emoji)
    if (existing) {
        existing.reacted = result.reacted
        existing.count += result.reacted ? 1 : -1
        if (existing.count <= 0)
            currentPost.value.reactions = currentPost.value.reactions.filter(r => r.emoji !== emoji)
    } else if (result.reacted) {
        currentPost.value.reactions = [...(currentPost.value.reactions ?? []), { emoji, count: 1, reacted: true }]
    }
}

async function toggleLike() {
    if (!currentPost.value) return
    const result = await $fetch(`${apiBaseUrl}/api/likePost`, {
        method: 'POST',
        body: { postid: currentPost.value.id, userid: userId.value },
    })
    currentPost.value.isLiked = result.liked
    currentPost.value.likeCount += result.liked ? 1 : -1
}

onMounted(() => {
    document.addEventListener('click', (e) => {
        if (pickerWrapRef.value && !pickerWrapRef.value.contains(e.target))
            showPicker.value = false
    })
})
</script>

<style>
#board-wrapper {
    padding: 20px 24px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.95rem;
}

/* 목록 (카드형) */
.board {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.post-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    background: rgba(var(--fg-rgb),0.03);
    border: 1px solid rgba(var(--fg-rgb),0.06);
    text-decoration: none;
    color: inherit;
}

.post-card:hover { background: rgba(var(--fg-rgb),0.06); border-color: rgba(var(--fg-rgb),0.12); }

.post-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
    font-size: 0.98rem;
    color: rgba(var(--fg-rgb),0.9);
}

.post-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.external-post-card {
    border-left: 2px solid rgba(124,196,255,0.4);
}
.external-post-card .hgi-globe-02 { color: #7cc4ff; flex-shrink: 0; }

.cw-icon {
    color: #ffb454;
    flex-shrink: 0;
}

.preview-text {
    font-weight: 400;
    color: rgba(var(--fg-rgb),0.65);
}

.post-author {
    font-weight: 700;
    font-size: 0.85rem;
    color: rgba(var(--fg-rgb),0.5);
    white-space: nowrap;
    flex-shrink: 0;
}

.datetime {
    font-size: 0.75rem;
    color: rgba(var(--fg-rgb),0.3);
    white-space: nowrap;
}

.empty {
    color: rgba(var(--fg-rgb),0.3);
    padding: 20px 0;
    font-size: 0.9rem;
}

/* 헤더 버튼 (항상 악센트 색 헤더 위라 테마 무관하게 흰색 고정) */
.write-btn-header {
    margin-left: auto;
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.35);
    color: white;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
}

.write-btn-header:hover { background: rgba(255,255,255,0.3); }

.back-btn-header {
    margin-left: auto;
    background: none;
    border: none;
    color: rgba(255,255,255,0.8);
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    padding: 3px 6px;
}

.back-btn-header:hover { color: white; }

.board-header-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.board-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.board-close-btn {
    margin-left: 0 !important;
}

/* 작성 폼 */
.create-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-grow: 1;
}

.post-input {
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.85);
    transition: border-color 0.15s, background 0.15s;
}

.post-input::placeholder { color: rgba(var(--fg-rgb),0.3); }

.post-input:focus {
    outline: none;
    border-color: var(--accent);
    background: rgba(var(--fg-rgb),0.1);
}

.post-textarea {
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
    min-height: 110px;
    flex-grow: 1;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.85);
    transition: border-color 0.15s, background 0.15s;
}

.post-textarea::placeholder { color: rgba(var(--fg-rgb),0.3); }

.post-textarea:focus {
    outline: none;
    border-color: var(--accent);
    background: rgba(var(--fg-rgb),0.1);
}

.submit-btn {
    align-self: flex-end;
    background-color: var(--accent);
    color: white;
    border: 0;
    padding: 8px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: inherit;
    transition: opacity 0.15s;
}

.submit-btn:hover { opacity: 0.88; }
.submit-btn:disabled { opacity: 0.35; cursor: default; }

/* 상세 */
.post-detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.post-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.08);
}

.like-btn {
    background: none;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    border-radius: 20px;
    padding: 2px 12px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    margin-left: auto;
    transition: all 0.15s;
    color: rgba(var(--fg-rgb),0.45);
}

.like-btn:hover { border-color: var(--accent); color: var(--accent); }

.like-btn.liked {
    background-color: var(--bgaccent);
    border-color: var(--accent);
    color: var(--accent);
}

.boost-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: rgba(var(--fg-rgb),0.4);
}

.remote-author {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    text-decoration: none;
}

.remote-author:hover { text-decoration: underline; }

.remote-handle {
    font-weight: 400;
    color: rgba(var(--fg-rgb),0.35);
}

.remote-cw-gate {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
    padding: 16px;
    border-radius: 10px;
    background: rgba(255,180,84,0.08);
    border: 1px solid rgba(255,180,84,0.25);
}

.remote-cw-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #ffb454;
}

.remote-original-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    margin-top: 8px;
    font-size: 0.85rem;
    color: rgba(var(--fg-rgb),0.4);
    text-decoration: none;
}
.remote-original-link:hover { color: rgba(var(--fg-rgb),0.7); text-decoration: underline; }

.post-content {
    line-height: 1.8;
    white-space: pre-wrap;
    font-size: 0.95rem;
    color: rgba(var(--fg-rgb),0.82);
}

.post-content img,
.comment-body img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    display: block;
    margin: 6px 0;
}

.comments-section { border-top: 1px solid rgba(var(--fg-rgb),0.08); padding-top: 4px; }

.comments-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.35);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 0 6px;
}

.comment {
    padding: 8px 0;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.06);
    font-size: 0.9rem;
}

.comment-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 2px;
    align-items: center;
}

.comment-body { color: rgba(var(--fg-rgb),0.7); white-space: pre-wrap; }

.comment-form {
    display: flex;
    gap: 8px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(var(--fg-rgb),0.08);
}

.comment-form .post-input { flex-grow: 1; }

/* 이모지 리액션 */
.reactions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 4px 0 8px;
}

.reaction-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(var(--fg-rgb),0.07);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 0.88rem;
    font-family: inherit;
    cursor: pointer;
    color: rgba(var(--fg-rgb),0.7);
    transition: all 0.1s;
}

.reaction-pill:hover {
    background: rgba(var(--fg-rgb),0.13);
    border-color: rgba(var(--fg-rgb),0.25);
}

.reaction-pill.reacted {
    background: var(--bgaccent);
    border-color: var(--accent);
    color: var(--accent);
}

.emoji-picker-wrap {
    position: relative;
}

.reaction-add-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px dashed rgba(var(--fg-rgb),0.2);
    background: none;
    color: rgba(var(--fg-rgb),0.4);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
}

.reaction-add-btn:hover {
    border-color: rgba(var(--fg-rgb),0.5);
    color: rgba(var(--fg-rgb),0.8);
}

.emoji-picker {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    background: var(--sidebar-bg);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 12px;
    padding: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    width: 200px;
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.emoji-preset {
    width: 36px;
    height: 36px;
    border: none;
    background: none;
    border-radius: 8px;
    font-size: 1.2rem;
    cursor: pointer;
    transition: background 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.emoji-preset:hover { background: rgba(var(--fg-rgb),0.1); }

.emoji-preset.reacted { background: var(--bgaccent); }
</style>
