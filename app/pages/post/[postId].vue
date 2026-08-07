<script setup>
import { marked } from 'marked'
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()

// 우리 서버 커스텀 이모지(:shortcode:) — 글/댓글/리액션 표시 시점에 치환
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
function withCustomEmoji(html) {
    return renderCustomEmojiText(html, customEmojiMap.value)
}

const postId = computed(() => Number(route.params.postId))

const { data: post, refresh } = await useAsyncData(
    `post-detail-${route.params.postId}`,
    () => $fetch(`${apiBaseUrl}/api/getPostById`, {
        method: 'POST',
        body: { postid: postId.value, userid: userId.value },
    }),
    { watch: [() => route.params.postId] }
)

if (!post.value) {
    throw createError({ statusCode: 404, message: '게시글을 찾을 수 없습니다' })
}

const commentContent = ref('')
const showPicker = ref(false)
const pickerWrapRef = ref(null)
const reactionBtnRef = ref(null)


async function toggleLike() {
    if (!post.value) return
    const result = await $fetch(`${apiBaseUrl}/api/likePost`, {
        method: 'POST',
        body: { postid: post.value.id, userid: userId.value },
    })
    post.value.isLiked = result.liked
    post.value.likeCount += result.liked ? 1 : -1
}

async function toggleReaction(emoji) {
    if (!post.value) return
    const result = await $fetch(`${apiBaseUrl}/api/reactPost`, {
        method: 'POST',
        body: { postid: post.value.id, userid: userId.value, emoji },
    })
    const existing = post.value.reactions?.find(r => r.emoji === emoji)
    if (existing) {
        existing.reacted = result.reacted
        existing.count += result.reacted ? 1 : -1
        if (existing.count <= 0)
            post.value.reactions = post.value.reactions.filter(r => r.emoji !== emoji)
    } else if (result.reacted) {
        post.value.reactions = [...(post.value.reactions ?? []), { emoji, count: 1, reacted: true }]
    }
}

const isOwnPost = computed(() => !!post.value?.userid && post.value.userid === userId.value)

// 뮤트 — WindowBoard.vue/WindowTimeline.vue와 동일한 패턴
const activeMuteKey = ref(null)
const revealedMuted = ref({})
function muteKeyFor(target) {
    return target.userid != null ? `local-${target.userid}` : `remote-${target.actorUrl}`
}
function toggleMuteMenu(target) {
    const key = muteKeyFor(target)
    activeMuteKey.value = activeMuteKey.value === key ? null : key
}
async function confirmMute(target, level) {
    if (!userId.value) return
    await $fetch(`${apiBaseUrl}/api/muteUser`, {
        method: 'POST',
        body: {
            userid: userId.value,
            targetUserId: target.userid ?? undefined,
            targetActorUrl: target.actorUrl ?? undefined,
            level,
        },
    }).catch(() => {})
    activeMuteKey.value = null
    await refresh()
}

const shareCopied = ref(false)
async function sharePost() {
    if (!post.value) return
    await navigator.clipboard.writeText(window.location.href)
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 1500)
}

const isEditing = ref(false)
const editorTab = ref('write')
const editTitleVal = ref('')
const editContentVal = ref('')
const editorRef = ref(null)
const showEmojiPicker = ref(false)
const emojiWrapRef = ref(null)
const emojiBtnRef = ref(null)

function insertEditMarkdown(before, after) {
    const el = editorRef.value
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = editContentVal.value.slice(start, end)
    editContentVal.value = editContentVal.value.slice(0, start) + before + selected + after + editContentVal.value.slice(end)
    nextTick(() => {
        el.focus()
        el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
}

function startEdit() {
    if (!post.value) return
    editTitleVal.value = post.value.title
    editContentVal.value = post.value.content
    editorTab.value = 'write'
    isEditing.value = true
}

async function saveEdit() {
    if (!editTitleVal.value.trim() || !editContentVal.value.trim() || !post.value) return
    await $fetch(`${apiBaseUrl}/api/editPost`, {
        method: 'POST',
        body: {
            postid: post.value.id,
            userid: userId.value,
            title: editTitleVal.value.trim(),
            content: editContentVal.value.trim(),
        },
    })
    isEditing.value = false
    await refresh()
}

const showDeleteConfirm = ref(false)
const deletingPost = ref(false)
async function doDeletePost() {
    if (!post.value || deletingPost.value) return
    deletingPost.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/deletePost`, {
            method: 'POST',
            body: { postid: post.value.id, userid: userId.value },
        })
        router.back()
    } finally {
        deletingPost.value = false
    }
}

async function submitComment() {
    if (!commentContent.value.trim() || !post.value) return
    const content = commentContent.value.trim()
    commentContent.value = ''
    await $fetch(`${apiBaseUrl}/api/createPost`, {
        method: 'POST',
        body: {
            serverid: post.value.serverid,
            roomid: post.value.roomid,
            userid: userId.value,
            title: content.slice(0, 50),
            content,
            replyto: post.value.id,
        },
    })
    await refresh()
}

onMounted(() => {
    ensureCustomEmojisLoaded()
    document.addEventListener('click', (e) => {
        // 이모지 피커는 <body>로 teleport돼서 wrap의 DOM 자손이 아니므로 따로 예외 처리해야 함
        if (e.target.closest('.emoji-picker-popover')) return
        if (pickerWrapRef.value && !pickerWrapRef.value.contains(e.target))
            showPicker.value = false
        if (emojiWrapRef.value && !emojiWrapRef.value.contains(e.target))
            showEmojiPicker.value = false
        if (!e.target.closest('.mute-action-wrap'))
            activeMuteKey.value = null
    })
})
</script>

<template>
    <div id="post-page">

        <!-- 상단 네비 바 -->
        <div id="post-nav">
            <button id="post-back-btn" @click="router.back()">
                <i class="hgi hgi-stroke hgi-arrow-left-01"></i>
                뒤로가기
            </button>
            <span id="post-nav-title">{{ post?.title }}</span>
        </div>

        <!-- 본문 -->
        <div id="post-card-wrap">
            <div id="post-card">

                <!-- 제목 + 메타 -->
                <div v-if="!isEditing" class="pd-header">
                    <NuxtLink v-if="post?.room" :to="post.room.path" class="pd-room-tag">
                        <i class="hgi hgi-stroke hgi-grid"></i>
                        {{ post.room.knownas }}
                    </NuxtLink>
                    <h1 class="pd-title">{{ post?.title }}</h1>
                    <div class="pd-meta">
                        <NuxtLink :to="post?.user?.username ? `/@${post.user.username}` : '#'" class="pd-author">
                            {{ post?.user?.knownas ?? post?.user?.username }}
                        </NuxtLink>
                        <span class="pd-date">{{ formatDate(post?.createdAt) }}</span>
                        <button class="like-btn" :class="{ liked: post?.isLiked }" @click="toggleLike">
                            ♥ {{ post?.likeCount ?? 0 }}
                        </button>
                        <div class="post-meta-actions">
                            <div class="share-btn-wrap">
                                <button class="post-icon-btn" @click="sharePost" title="공유">
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
                            <button v-if="isOwnPost && !post?.objectId" class="post-icon-btn" @click="startEdit" title="수정">
                                <i class="hgi hgi-stroke hgi-pencil-edit-02"></i>
                            </button>
                            <button v-if="isOwnPost" class="post-icon-btn danger" @click="showDeleteConfirm = true" title="삭제">
                                <i class="hgi hgi-stroke hgi-delete-02"></i>
                            </button>
                            <div v-if="!isOwnPost && userId" class="mute-action-wrap">
                                <button class="post-icon-btn" @click.stop="toggleMuteMenu({ userid: post.userid })" title="뮤트">
                                    <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                                </button>
                                <div v-if="activeMuteKey === muteKeyFor({ userid: post.userid })" class="mute-menu" @click.stop>
                                    <button @click="confirmMute({ userid: post.userid }, 'soft')">소프트 뮤트</button>
                                    <button @click="confirmMute({ userid: post.userid }, 'hard')">하드 뮤트</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 내용 -->
                <div v-if="!isEditing" class="pd-content md-content" v-html="withCustomEmoji(String(marked.parse(post?.content ?? '')))"></div>

                <!-- 수정 폼 -->
                <div v-else class="create-form">
                    <input v-model="editTitleVal" placeholder="제목" class="post-input" />
                    <div class="editor-tabs">
                        <button class="editor-tab-btn" :class="{ active: editorTab === 'write' }" @click="editorTab = 'write'">작성</button>
                        <button class="editor-tab-btn" :class="{ active: editorTab === 'preview' }" @click="editorTab = 'preview'">미리보기</button>
                    </div>
                    <template v-if="editorTab === 'write'">
                        <div class="wiki-toolbar">
                            <button class="toolbar-btn" @click="insertEditMarkdown('**', '**')" title="굵게"><b>B</b></button>
                            <button class="toolbar-btn" @click="insertEditMarkdown('*', '*')" title="기울임"><i>I</i></button>
                            <button class="toolbar-btn" @click="insertEditMarkdown('## ', '')" title="제목">H</button>
                            <button class="toolbar-btn" @click="insertEditMarkdown('- ', '')" title="목록">•</button>
                            <div class="toolbar-emoji-wrap" ref="emojiWrapRef">
                                <button ref="emojiBtnRef" class="toolbar-btn" @click.stop="showEmojiPicker = !showEmojiPicker" title="이모지">
                                    <i class="hgi hgi-stroke hgi-smile"></i>
                                </button>
                                <EmojiPicker
                                    v-if="showEmojiPicker"
                                    placement="bottom"
                                    :anchor="emojiBtnRef"
                                    @select="(e) => { insertEditMarkdown(e, ''); showEmojiPicker = false }"
                                />
                            </div>
                            <span class="toolbar-sep"></span>
                            <span class="toolbar-hint">마크다운 지원</span>
                        </div>
                        <textarea
                            ref="editorRef"
                            v-model="editContentVal"
                            placeholder="내용을 입력하세요... (마크다운 사용 가능)"
                            class="post-textarea wiki-textarea"
                        ></textarea>
                    </template>
                    <div v-else class="pd-content md-content preview-pane" v-html="withCustomEmoji(String(marked.parse(editContentVal.trim() || '_미리볼 내용이 없습니다._')))"></div>
                    <div class="wiki-form-actions">
                        <button class="back-btn-header" @click="isEditing = false">취소</button>
                        <button class="submit-btn" @click="saveEdit" :disabled="!editTitleVal.trim() || !editContentVal.trim()">수정 완료</button>
                    </div>
                </div>

                <!-- 이모지 리액션 -->
                <div class="reactions-row">
                    <button
                        v-for="r in post?.reactions"
                        :key="r.emoji"
                        class="reaction-pill"
                        :class="{ reacted: r.reacted }"
                        @click="toggleReaction(r.emoji)"
                    >
                        <span v-html="withCustomEmoji(escapeHtml(r.emoji))"></span> {{ r.count }}
                    </button>
                    <div class="emoji-picker-wrap" ref="pickerWrapRef">
                        <button ref="reactionBtnRef" class="reaction-add-btn" @click.stop="showPicker = !showPicker">+</button>
                        <EmojiPicker v-if="showPicker" :anchor="reactionBtnRef" @select="(e) => { toggleReaction(e); showPicker = false }" />
                    </div>
                </div>

                <!-- 댓글 -->
                <div class="pd-comments">
                    <div class="pd-comments-title">댓글 {{ post?.comments?.length ?? 0 }}</div>

                    <div v-for="comment in post?.comments" :key="comment.id" class="pd-comment">
                        <div v-if="comment.muted === 'soft' && !revealedMuted[`comment-${comment.id}`]" class="remote-cw-gate">
                            <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 댓글입니다</div>
                            <button class="submit-btn" @click="revealedMuted[`comment-${comment.id}`] = true">그래도 보기</button>
                        </div>
                        <template v-else>
                            <div class="pd-comment-meta">
                                <template v-if="comment.remoteActorHandle">
                                    <a :href="comment.remoteActorUrl" target="_blank" rel="noopener noreferrer" class="pd-author remote-author" title="fediverse에서 온 답글">
                                        <i class="hgi hgi-stroke hgi-globe-02"></i>
                                        <span v-if="comment.remoteActorName" v-html="comment.remoteActorName"></span>
                                        <span v-else>{{ comment.remoteActorHandle }}</span>
                                        <span class="remote-handle">{{ comment.remoteActorHandle }}</span>
                                    </a>
                                </template>
                                <NuxtLink v-else :to="comment.user?.username ? `/@${comment.user.username}` : '#'" class="pd-author">
                                    {{ comment.user?.knownas ?? comment.user?.username }}
                                </NuxtLink>
                                <span class="pd-date">{{ formatDate(comment.createdAt) }}</span>
                                <div
                                    v-if="userId && (comment.remoteActorHandle || comment.userid !== userId)"
                                    class="mute-action-wrap"
                                >
                                    <button
                                        class="post-icon-btn"
                                        @click.stop="toggleMuteMenu(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid })"
                                        title="뮤트"
                                    >
                                        <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                                    </button>
                                    <div
                                        v-if="activeMuteKey === muteKeyFor(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid })"
                                        class="mute-menu"
                                        @click.stop
                                    >
                                        <button @click="confirmMute(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid }, 'soft')">소프트 뮤트</button>
                                        <button @click="confirmMute(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid }, 'hard')">하드 뮤트</button>
                                    </div>
                                </div>
                            </div>
                            <div v-if="comment.remoteActorHandle" class="pd-comment-body remote" v-html="comment.content"></div>
                            <div v-else class="pd-comment-body" v-html="withCustomEmoji(escapeHtml(comment.content))"></div>
                        </template>
                    </div>

                    <div v-if="!post?.comments?.length" class="pd-empty">댓글이 없습니다.</div>

                    <div class="pd-comment-form">
                        <input
                            v-model="commentContent"
                            placeholder="댓글 작성..."
                            class="pd-input"
                            @keydown.enter="submitComment"
                        />
                        <button class="pd-submit-btn" @click="submitComment" :disabled="!commentContent.trim()">작성</button>
                    </div>
                </div>

            </div>
        </div>

        <!-- 삭제 확인 -->
        <div v-if="showDeleteConfirm" class="admin-confirm-overlay" @click.self="showDeleteConfirm = false">
            <div class="admin-confirm-box">
                <p class="admin-confirm-msg">이 글을 정말 삭제할까요?<br /><span style="font-size:0.82rem;opacity:0.55">삭제하면 되돌릴 수 없습니다.</span></p>
                <div class="admin-confirm-actions">
                    <button class="back-btn-header" @click="showDeleteConfirm = false">취소</button>
                    <button class="submit-btn danger-btn" @click="doDeletePost" :disabled="deletingPost">
                        {{ deletingPost ? '삭제 중...' : '삭제' }}
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
#post-page {
    min-height: 100dvh;
    background-color: var(--page-bg);
    padding-bottom: 60px;
}

#post-nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 3rem;
    background-color: var(--accent, #D21F3C);
    color: white;
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 16px;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    font-size: 0.95rem;
    font-weight: 700;
}

/* 상단 네비바도 항상 악센트 색 배경이라 테마 무관하게 흰색 고정 */
#post-back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.8);
    font-size: 0.88rem;
    font-weight: 400;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.1s;
    flex-shrink: 0;
}
#post-back-btn:hover { color: white; }

#post-nav-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.95rem;
}

#post-card-wrap {
    display: flex;
    justify-content: center;
    padding: 5rem 20px 0;
}

#post-card {
    width: 100%;
    max-width: 720px;
    background: var(--surface-0);
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(var(--fg-rgb),0.07);
    padding: 28px 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.pd-header {
    border-bottom: 1px solid rgba(var(--fg-rgb),0.08);
    padding-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pd-room-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: fit-content;
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.4);
    text-decoration: none;
    transition: color 0.1s;
}
.pd-room-tag:hover { color: var(--accent); }

.pd-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.9);
    margin: 0;
    line-height: 1.3;
}

.pd-meta {
    display: flex;
    align-items: center;
    gap: 10px;
}

.pd-author {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--accent, #D21F3C);
    text-decoration: none;
}
.pd-author:hover { text-decoration: underline; }

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

.pd-date {
    font-size: 0.8rem;
    color: rgba(var(--fg-rgb),0.3);
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
.like-btn.liked { background-color: var(--bgaccent); border-color: var(--accent); color: var(--accent); }

.post-meta-actions {
    display: flex;
    gap: 2px;
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
.post-icon-btn.danger:hover { background: rgba(192,16,42,0.12); color: #e0304a; }

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

.mute-action-wrap { position: relative; display: flex; }

.mute-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--surface-2);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    box-shadow: var(--modal-shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 20;
    white-space: nowrap;
}

.mute-menu button {
    background: none;
    border: none;
    padding: 8px 14px;
    font-size: 0.82rem;
    font-family: inherit;
    color: rgba(var(--fg-rgb),0.75);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
}
.mute-menu button:hover { background: rgba(var(--fg-rgb),0.07); }

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

/* 수정 폼 */
.create-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.post-input {
    /* input은 flex 자식일 때 기본값이 min-width:auto라서, 버튼과 한 줄에 나란히 있으면
       내용 크기 밑으로 안 줄어들고 좁은 화면에서 행 전체를 밀어버림 — 항상 줄어들 수 있게 함 */
    min-width: 0;
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
    min-height: 200px;
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

.editor-tabs {
    display: flex;
    gap: 4px;
}

.editor-tab-btn {
    background: none;
    border: none;
    border-radius: 6px 6px 0 0;
    padding: 6px 12px;
    font-size: 0.85rem;
    font-family: inherit;
    color: rgba(var(--fg-rgb),0.45);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
}
.editor-tab-btn:hover { color: rgba(var(--fg-rgb),0.8); }
.editor-tab-btn.active {
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.9);
    font-weight: 600;
}

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
}

.preview-pane {
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 10px 14px;
    min-height: 200px;
    background: rgba(var(--fg-rgb),0.03);
}

.wiki-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.submit-btn {
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

.back-btn-header {
    background: none;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    color: rgba(var(--fg-rgb),0.6);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: inherit;
}
.back-btn-header:hover { border-color: rgba(var(--fg-rgb),0.35); color: rgba(var(--fg-rgb),0.9); }

.admin-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.admin-confirm-box {
    background: var(--surface-2);
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 12px;
    padding: 24px 28px;
    max-width: 340px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}

.admin-confirm-msg {
    margin: 0;
    line-height: 1.6;
    color: rgba(var(--fg-rgb),0.85);
    font-size: 0.95rem;
}

.admin-confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.danger-btn {
    background-color: #c0102a !important;
}
.danger-btn:hover { background-color: #a00020 !important; }

.pd-content {
    font-size: 1rem;
    line-height: 1.85;
    color: rgba(var(--fg-rgb),0.82);
    overflow-wrap: break-word;
    word-break: break-word;
}

.pd-content :deep(a),
.pd-comment-body :deep(a) {
    color: var(--accent, #D21F3C);
    text-decoration: underline;
    text-decoration-color: rgba(var(--fg-rgb),0.25);
}

/* v-html로 넣는 마크다운 렌더링 결과물이라 scoped 속성이 안 붙음 -> :deep() 필요 */
.pd-content :deep(p) { margin: 0.5em 0; }
.pd-content :deep(p:first-child) { margin-top: 0; }
.pd-content :deep(p:last-child) { margin-bottom: 0; }

.pd-content :deep(blockquote) {
    margin: 0.6em 0;
    padding: 2px 14px;
    border-left: 3px solid rgba(var(--fg-rgb),0.2);
    color: rgba(var(--fg-rgb),0.6);
    font-style: italic;
}
.pd-content :deep(blockquote p) { margin: 0.4em 0; }

.pd-content :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    display: block;
    margin: 6px 0;
}

/* 리모트 커스텀 이모지(:shortcode:) — 본문 사진과 달리 글자 크기에 맞춰 인라인으로 */
.pd-content :deep(img.custom-emoji),
.pd-comment-body :deep(img.custom-emoji) {
    display: inline-block;
    width: 1.35em;
    height: 1.35em;
    max-width: 1.35em;
    border-radius: 0;
    margin: 0 0.05em;
    vertical-align: middle;
    transition: transform 0.15s ease;
}
.pd-content :deep(img.custom-emoji:hover),
.pd-comment-body :deep(img.custom-emoji:hover) {
    transform: scale(1.8);
}

.reactions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 4px 0 4px;
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
.reaction-pill:hover { background: rgba(var(--fg-rgb),0.13); border-color: rgba(var(--fg-rgb),0.25); }
.reaction-pill.reacted { background: var(--bgaccent); border-color: var(--accent); color: var(--accent); }

.emoji-picker-wrap { position: relative; }

.reaction-add-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px dashed rgba(var(--fg-rgb),0.2);
    background: none;
    color: rgba(var(--fg-rgb),0.4);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
}
.reaction-add-btn:hover { border-color: rgba(var(--fg-rgb),0.5); color: rgba(var(--fg-rgb),0.8); }


.pd-comments {
    border-top: 1px solid rgba(var(--fg-rgb),0.08);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pd-comments-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.35);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.pd-comment {
    padding: 10px 0;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.06);
    font-size: 0.9rem;
}

.pd-comment-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;
}

.pd-comment-body { color: rgba(var(--fg-rgb),0.7); white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; }
.pd-comment-body.remote { white-space: normal; }
.pd-comment-body.remote :deep(p) { margin: 0.5em 0; }
.pd-comment-body.remote :deep(p:first-child) { margin-top: 0; }
.pd-comment-body.remote :deep(p:last-child) { margin-bottom: 0; }

.pd-empty {
    color: rgba(var(--fg-rgb),0.28);
    font-size: 0.9rem;
    padding: 8px 0;
}

.pd-comment-form {
    display: flex;
    gap: 8px;
    padding-top: 6px;
}

.pd-input {
    flex-grow: 1;
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.85);
    transition: border-color 0.15s, background 0.15s;
}
.pd-input::placeholder { color: rgba(var(--fg-rgb),0.3); }
.pd-input:focus { outline: none; border-color: var(--accent); background: rgba(var(--fg-rgb),0.1); }

.pd-submit-btn {
    background-color: var(--accent);
    color: white;
    border: 0;
    padding: 8px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: inherit;
    transition: opacity 0.15s;
    flex-shrink: 0;
}
.pd-submit-btn:hover { opacity: 0.88; }
.pd-submit-btn:disabled { opacity: 0.35; cursor: default; }
</style>
