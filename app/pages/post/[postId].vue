<script setup>
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()

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

const EMOJI_PRESETS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀', '✅', '💯', '🥰']
const commentContent = ref('')
const showPicker = ref(false)
const pickerWrapRef = ref(null)

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

function formatDate(str) {
    if (!str) return ''
    return str.split('T')[0] === today
        ? str.split('T')[1].slice(0, 5)
        : str.split('T')[0]
}

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
    document.addEventListener('click', (e) => {
        if (pickerWrapRef.value && !pickerWrapRef.value.contains(e.target))
            showPicker.value = false
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
                <div class="pd-header">
                    <h1 class="pd-title">{{ post?.title }}</h1>
                    <div class="pd-meta">
                        <NuxtLink :to="post?.user?.username ? `/@${post.user.username}` : '#'" class="pd-author">
                            {{ post?.user?.knownas ?? post?.user?.username }}
                        </NuxtLink>
                        <span class="pd-date">{{ formatDate(post?.createdAt) }}</span>
                        <button class="like-btn" :class="{ liked: post?.isLiked }" @click="toggleLike">
                            ♥ {{ post?.likeCount ?? 0 }}
                        </button>
                    </div>
                </div>

                <!-- 내용 -->
                <div class="pd-content">{{ post?.content }}</div>

                <!-- 이모지 리액션 -->
                <div class="reactions-row">
                    <button
                        v-for="r in post?.reactions"
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
                                :class="{ reacted: post?.reactions?.some(r => r.emoji === e && r.reacted) }"
                                @click="toggleReaction(e); showPicker = false"
                            >{{ e }}</button>
                        </div>
                    </div>
                </div>

                <!-- 댓글 -->
                <div class="pd-comments">
                    <div class="pd-comments-title">댓글 {{ post?.comments?.length ?? 0 }}</div>

                    <div v-for="comment in post?.comments" :key="comment.id" class="pd-comment">
                        <div class="pd-comment-meta">
                            <NuxtLink :to="comment.user?.username ? `/@${comment.user.username}` : '#'" class="pd-author">
                                {{ comment.user?.knownas ?? comment.user?.username }}
                            </NuxtLink>
                            <span class="pd-date">{{ formatDate(comment.createdAt) }}</span>
                        </div>
                        <div class="pd-comment-body">{{ comment.content }}</div>
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

    </div>
</template>

<style scoped>
#post-page {
    min-height: 100dvh;
    background-color: #1a1a24;
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
    background: #16161e;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.07);
    padding: 28px 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.pd-header {
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pd-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
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

.pd-date {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.3);
}

.like-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px;
    padding: 2px 12px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    margin-left: auto;
    transition: all 0.15s;
    color: rgba(255,255,255,0.45);
}
.like-btn:hover { border-color: var(--accent); color: var(--accent); }
.like-btn.liked { background-color: var(--bgaccent); border-color: var(--accent); color: var(--accent); }

.pd-content {
    font-size: 1rem;
    line-height: 1.85;
    white-space: pre-wrap;
    color: rgba(255,255,255,0.82);
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
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 0.88rem;
    font-family: inherit;
    cursor: pointer;
    color: rgba(255,255,255,0.7);
    transition: all 0.1s;
}
.reaction-pill:hover { background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.25); }
.reaction-pill.reacted { background: var(--bgaccent); border-color: var(--accent); color: var(--accent); }

.emoji-picker-wrap { position: relative; }

.reaction-add-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px dashed rgba(255,255,255,0.2);
    background: none;
    color: rgba(255,255,255,0.4);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
}
.reaction-add-btn:hover { border-color: rgba(255,255,255,0.5); color: rgba(255,255,255,0.8); }

.emoji-picker {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    background: #1e1e2a;
    border: 1px solid rgba(255,255,255,0.12);
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
.emoji-preset:hover { background: rgba(255,255,255,0.1); }
.emoji-preset.reacted { background: var(--bgaccent); }

.pd-comments {
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pd-comments-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.pd-comment {
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 0.9rem;
}

.pd-comment-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;
}

.pd-comment-body { color: rgba(255,255,255,0.7); white-space: pre-wrap; }

.pd-empty {
    color: rgba(255,255,255,0.28);
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
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.85);
    transition: border-color 0.15s, background 0.15s;
}
.pd-input::placeholder { color: rgba(255,255,255,0.3); }
.pd-input:focus { outline: none; border-color: var(--accent); background: rgba(255,255,255,0.1); }

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
