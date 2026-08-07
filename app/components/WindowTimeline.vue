<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-globe-02"></i>
            <span class="board-header-title">타임라인</span>
            <div class="board-header-actions">
                <NuxtLink v-if="currentView === 'list'" to="/preferences" class="back-btn-header">팔로우 관리</NuxtLink>
                <button v-else class="back-btn-header" @click="currentView = 'list'">← 목록</button>
                <button class="window-close-btn board-close-btn" @click="$emit('close')">✕</button>
            </div>
        </div>

        <!-- 목록 -->
        <div v-if="currentView === 'list'" id="board-wrapper">
            <template v-if="isLoggedIn">
                <div v-if="followingFeed.length" class="board">
                    <template v-for="p in followingFeed" :key="p.id">
                        <!-- 뮤트(소프트)된 글 게이트 — 로컬/원격 공통 -->
                        <div
                            v-if="p.muted === 'soft' && !revealedMuted[p.id]"
                            class="post-card remote-cw-gate"
                        >
                            <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 게시물입니다</div>
                            <button class="submit-btn" @click.stop="revealedMuted[p.id] = true">그래도 보기</button>
                        </div>
                        <!-- 로컬 글: 제목만, 클릭하면 게시글 페이지로 (답글은 getFollowingFeed에서 이미 제외됨) -->
                        <NuxtLink v-else-if="!p.isRemote" :to="`/post/${p.id}`" class="post-card">
                            <div class="post-card-title">{{ p.title }}</div>
                            <div class="post-card-meta">
                                <span class="post-author">{{ p.user?.knownas ?? p.user?.username }}</span>
                                <span class="datetime">{{ formatDate(p.createdAt) }}</span>
                            </div>
                        </NuxtLink>
                        <!-- 원격 글: 미리보기 카드, 클릭하면 상세보기 -->
                        <div v-else class="post-card external-post-card" @click="openRemotePost(p)">
                            <div class="external-post-body">
                                <div class="post-card-title">
                                    <i class="hgi hgi-stroke hgi-globe-02"></i>
                                    <template v-if="p.summary">
                                        <i class="hgi hgi-stroke hgi-alert-02 cw-icon" title="열람주의(CW)"></i>
                                        <span v-html="p.summary"></span>
                                    </template>
                                    <span v-else class="preview-text" v-html="stripHtmlKeepEmoji(p.content)"></span>
                                </div>
                                <div class="post-card-meta">
                                    <span v-if="p.sourceName" class="post-author remote-handle" v-html="p.sourceName"></span>
                                    <span v-else class="post-author remote-handle">{{ p.sourceHandle }}</span>
                                    <span class="datetime">{{ formatDate(p.createdAt) }}</span>
                                </div>
                            </div>
                            <a
                                class="remote-server-badge"
                                :href="`https://${remoteServerHost(p.sourceActorUrl)}`"
                                target="_blank"
                                rel="noopener noreferrer"
                                :title="remoteServerInfo[remoteServerHost(p.sourceActorUrl)]?.name || remoteServerHost(p.sourceActorUrl)"
                                :style="{ background: badgeBg(remoteServerHost(p.sourceActorUrl)) }"
                                @click.stop
                            >
                                <img
                                    v-if="badgeImgSrc(remoteServerHost(p.sourceActorUrl))"
                                    :src="badgeImgSrc(remoteServerHost(p.sourceActorUrl))"
                                    alt=""
                                    @error="onBadgeImgError(badgeImgSrc(remoteServerHost(p.sourceActorUrl)))"
                                />
                                <span v-else>{{ remoteServerHost(p.sourceActorUrl)[0]?.toUpperCase() }}</span>
                            </a>
                        </div>
                    </template>
                </div>
                <div v-else class="empty">
                    아직 팔로우한 사람이 없거나, 팔로우한 사람이 쓴 글이 없습니다.<br />
                    <NuxtLink to="/preferences" style="color:var(--accent)">설정에서 원격 계정을 팔로우해보세요.</NuxtLink>
                </div>
                <button v-if="hasMoreToShow" class="load-more-btn" :disabled="loadingMore" @click="loadMore">
                    {{ loadingMore ? '불러오는 중...' : '더보기' }}
                </button>
            </template>
            <div v-else class="empty">로그인 후 이용할 수 있습니다.</div>
        </div>

        <!-- 원격 글 상세 -->
        <div v-else-if="currentView === 'remote-detail' && currentRemotePost" id="board-wrapper">
            <div class="post-detail">
                <div class="post-meta">
                    <a :href="currentRemotePost.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author">
                        <i class="hgi hgi-stroke hgi-globe-02"></i>
                        <span v-if="currentRemotePost.sourceName" v-html="currentRemotePost.sourceName"></span>
                        <span v-else>{{ currentRemotePost.sourceHandle }}</span>
                        <span class="remote-handle">{{ currentRemotePost.sourceHandle }}</span>
                    </a>
                    <span class="datetime">{{ formatDate(currentRemotePost.createdAt) }}</span>
                    <div v-if="userId" class="mute-action-wrap">
                        <button class="post-icon-btn" @click.stop="toggleMuteMenu({ actorUrl: currentRemotePost.sourceActorUrl })" title="뮤트">
                            <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                        </button>
                        <div v-if="activeMuteKey === muteKeyFor({ actorUrl: currentRemotePost.sourceActorUrl })" class="mute-menu" @click.stop>
                            <button @click="confirmMute({ actorUrl: currentRemotePost.sourceActorUrl }, 'soft')">소프트 뮤트</button>
                            <button @click="confirmMute({ actorUrl: currentRemotePost.sourceActorUrl }, 'hard')">하드 뮤트</button>
                        </div>
                    </div>
                </div>

                <div v-if="currentRemotePost.summary && !showRemoteContent" class="remote-cw-gate">
                    <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="currentRemotePost.summary"></span></div>
                    <button class="submit-btn" @click="showRemoteContent = true">내용 보기</button>
                </div>
                <div v-else class="post-content md-content" v-html="currentRemotePost.content"></div>

                <div v-if="userId" class="post-meta">
                    <button class="like-btn" :class="{ liked: currentRemotePost.liked }" @click="toggleRemoteLike">
                        ♥ {{ currentRemotePost.liked ? '좋아요 취소' : '좋아요' }}
                    </button>
                </div>

                <a :href="currentRemotePost.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="remote-original-link">
                    원 계정에서 보기 <i class="hgi hgi-stroke hgi-arrow-up-right-01"></i>
                </a>

                <div class="comments-section">
                    <div class="comments-title">댓글 {{ remoteReplies.length }}</div>
                    <div v-for="comment in remoteReplies" :key="comment.id" class="comment">
                        <div v-if="comment.muted === 'soft' && !revealedMuted[`reply-${comment.id}`]" class="remote-cw-gate">
                            <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 댓글입니다</div>
                            <button class="submit-btn" @click="revealedMuted[`reply-${comment.id}`] = true">그래도 보기</button>
                        </div>
                        <template v-else>
                            <div class="comment-meta">
                                <template v-if="comment.remoteActorHandle">
                                    <a :href="comment.remoteActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author" title="fediverse에서 온 답글">
                                        <i class="hgi hgi-stroke hgi-globe-02"></i>
                                        <span v-if="comment.remoteActorName" v-html="comment.remoteActorName"></span>
                                        <span v-else>{{ comment.remoteActorHandle }}</span>
                                        <span class="remote-handle">{{ comment.remoteActorHandle }}</span>
                                    </a>
                                </template>
                                <NuxtLink v-else :to="comment.user?.username ? `/@${comment.user.username}` : '#'" class="post-author user-name-link">{{ comment.user?.knownas ?? comment.user?.username }}</NuxtLink>
                                <span class="datetime">{{ formatDate(comment.createdAt) }}</span>
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
                            <div v-if="comment.remoteActorHandle" class="comment-body remote" v-html="comment.content"></div>
                            <div v-else class="comment-body">{{ comment.content }}</div>
                        </template>
                    </div>
                    <div class="empty" v-if="!remoteReplies.length">댓글이 없습니다.</div>
                </div>

                <div v-if="userId" class="comment-form">
                    <input v-model="remoteReplyContent" placeholder="댓글(답글로 전달됨) 작성..." class="post-input" @keydown.enter="submitRemoteReply" />
                    <button class="submit-btn" @click="submitRemoteReply" :disabled="!remoteReplyContent.trim()">작성</button>
                </div>
                <div v-else class="empty" style="padding:8px 0">로그인 후 좋아요/댓글을 남길 수 있어요.</div>
            </div>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()

// 뮤트 — WindowBoard.vue와 동일한 패턴(소프트: 게이트+"그래도 보기", 하드: 서버가 애초에 안 내려줌)
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
    await loadFirstPage()
    if (currentView.value === 'remote-detail' && currentRemotePost.value) await refreshRemoteReplies()
}

onMounted(() => {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mute-action-wrap')) activeMuteKey.value = null
    })
})

// 로컬 팔로우 글/원격 팔로우 글을 각자 독립적으로 페이지네이션(WindowBoard.vue의 게시판 목록과 동일한 패턴) —
// "더보기" 클릭 시 두 소스 모두 다음 페이지를 불러와서 누적한 뒤 날짜순으로 다시 합쳐서 보여줌
const PAGE_SIZE = 20

const localItems = ref([])
const localOffset = ref(0)
const hasMoreLocal = ref(false)

const remoteItems = ref([])
const remoteOffset = ref(0)
const hasMoreRemote = ref(false)

const loadingMore = ref(false)

async function fetchFeedPage(lOffset, rOffset) {
    if (!userId.value) return { localPosts: [], hasMoreLocal: false, remotePosts: [], hasMoreRemote: false }
    return await $fetch(`${apiBaseUrl}/api/getFollowingFeed`, {
        method: 'POST',
        body: { userid: userId.value, localOffset: lOffset, remoteOffset: rOffset },
    }).catch(() => ({ localPosts: [], hasMoreLocal: false, remotePosts: [], hasMoreRemote: false }))
}

async function loadFirstPage() {
    localOffset.value = 0
    remoteOffset.value = 0
    const res = await fetchFeedPage(0, 0)
    localItems.value = res.localPosts ?? []
    hasMoreLocal.value = res.hasMoreLocal ?? false
    remoteItems.value = res.remotePosts ?? []
    hasMoreRemote.value = res.hasMoreRemote ?? false
}

await loadFirstPage()
watch(userId, loadFirstPage)

async function loadMore() {
    if (loadingMore.value) return
    loadingMore.value = true
    try {
        const tasks = []
        if (hasMoreLocal.value) {
            const nextOffset = localOffset.value + PAGE_SIZE
            tasks.push(fetchFeedPage(nextOffset, remoteOffset.value).then((res) => {
                localOffset.value = nextOffset
                localItems.value = [...localItems.value, ...(res.localPosts ?? [])]
                hasMoreLocal.value = res.hasMoreLocal ?? false
            }))
        }
        if (hasMoreRemote.value) {
            const nextOffset = remoteOffset.value + PAGE_SIZE
            tasks.push(fetchFeedPage(localOffset.value, nextOffset).then((res) => {
                remoteOffset.value = nextOffset
                remoteItems.value = [...remoteItems.value, ...(res.remotePosts ?? [])]
                hasMoreRemote.value = res.hasMoreRemote ?? false
            }))
        }
        await Promise.all(tasks)
    } finally {
        loadingMore.value = false
    }
}

const hasMoreToShow = computed(() => hasMoreLocal.value || hasMoreRemote.value)

const followingFeed = computed(() =>
    [...localItems.value, ...remoteItems.value].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()),
)

// 제목/미리보기 줄에서도 커스텀 이모지(:shortcode:)는 살리고 나머지 태그만 지움 (WindowBoard.vue와 동일 로직)
function stripHtmlKeepEmoji(html) {
    if (!html) return ''
    const emojiTags = []
    const withPlaceholders = html.replace(/<img[^>]*class="[^"]*custom-emoji[^"]*"[^>]*>/g, (match) => {
        emojiTags.push(match)
        return ` EMOJI${emojiTags.length - 1} `
    })
    const stripped = withPlaceholders.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return stripped.replace(/ EMOJI(\d+) /g, (_, i) => emojiTags[Number(i)])
}

// 원격 글 작성자의 서버 뱃지 (WindowBoard.vue와 동일 로직)
function remoteServerHost(actorUrl) {
    try { return new URL(actorUrl).host } catch { return '' }
}

function remoteServerFallbackColor(host) {
    let hash = 0
    for (let i = 0; i < host.length; i++) hash = host.charCodeAt(i) + ((hash << 5) - hash)
    return `hsl(${Math.abs(hash) % 360}, 55%, 42%)`
}
function badgeBg(host) {
    return remoteServerInfo.value[host]?.themeColor || remoteServerFallbackColor(host)
}

const remoteServerInfo = ref({})
async function loadRemoteServerInfo(host) {
    if (!host || host in remoteServerInfo.value) return
    remoteServerInfo.value = { ...remoteServerInfo.value, [host]: null }
    const info = await $fetch(`${apiBaseUrl}/api/getRemoteServerInfo`, {
        method: 'POST',
        body: { host },
    }).catch(() => null)
    remoteServerInfo.value = { ...remoteServerInfo.value, [host]: info }
}

const failedBadgeSrcs = ref(new Set())
function badgeImgSrc(host) {
    const iconUrl = remoteServerInfo.value[host]?.iconUrl
    if (iconUrl && !failedBadgeSrcs.value.has(iconUrl)) return iconUrl
    const favicon = `https://${host}/favicon.ico`
    if (!failedBadgeSrcs.value.has(favicon)) return favicon
    return null
}
function onBadgeImgError(src) {
    failedBadgeSrcs.value = new Set(failedBadgeSrcs.value).add(src)
}

watch(followingFeed, (feed) => {
    for (const p of feed) {
        if (!p.isRemote) continue
        loadRemoteServerInfo(remoteServerHost(p.sourceActorUrl))
    }
}, { immediate: true })

const currentView = ref('list')
const currentRemotePost = ref(null)
const showRemoteContent = ref(false)
const remoteReplyContent = ref('')
const remoteReplies = ref([])

async function openRemotePost(post) {
    currentRemotePost.value = post
    showRemoteContent.value = false
    remoteReplyContent.value = ''
    currentView.value = 'remote-detail'
    await refreshRemoteReplies()
}

async function refreshRemoteReplies() {
    if (!currentRemotePost.value) return
    remoteReplies.value = await $fetch(`${apiBaseUrl}/api/getRemoteFeedPostReplies`, {
        method: 'POST',
        body: { objectId: currentRemotePost.value.objectId, viewerUserId: userId.value ?? null },
    }).catch(() => [])
}

async function toggleRemoteLike() {
    if (!currentRemotePost.value) return
    const result = await $fetch(`${apiBaseUrl}/api/likeFollowingFeedPost`, {
        method: 'POST',
        body: { id: currentRemotePost.value.feedPostId, userid: userId.value },
    })
    currentRemotePost.value.liked = result.liked
}

async function submitRemoteReply() {
    if (!remoteReplyContent.value.trim() || !currentRemotePost.value) return
    const content = remoteReplyContent.value.trim()
    remoteReplyContent.value = ''
    const reply = await $fetch(`${apiBaseUrl}/api/replyToFollowingFeedPost`, {
        method: 'POST',
        body: {
            userid: userId.value,
            feedPostId: currentRemotePost.value.feedPostId,
            content,
        },
    })
    remoteReplies.value = [...remoteReplies.value, reply]
}
</script>
