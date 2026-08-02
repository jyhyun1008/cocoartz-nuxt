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
                        <!-- 로컬 글: 제목만, 클릭하면 게시글 페이지로 -->
                        <NuxtLink v-if="!p.isRemote" :to="`/post/${p.id}`" class="post-card">
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
                                    <span class="post-author remote-handle">{{ p.sourceName || p.sourceHandle }}</span>
                                    <span class="datetime">{{ formatDate(p.createdAt) }}</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
                <div v-else class="empty">
                    아직 팔로우한 사람이 없거나, 팔로우한 사람이 쓴 글이 없습니다.<br />
                    <NuxtLink to="/preferences" style="color:var(--accent)">설정에서 원격 계정을 팔로우해보세요.</NuxtLink>
                </div>
            </template>
            <div v-else class="empty">로그인 후 이용할 수 있습니다.</div>
        </div>

        <!-- 원격 글 상세 -->
        <div v-else-if="currentView === 'remote-detail' && currentRemotePost" id="board-wrapper">
            <div class="post-detail">
                <div class="post-meta">
                    <a :href="currentRemotePost.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author">
                        <i class="hgi hgi-stroke hgi-globe-02"></i>
                        {{ currentRemotePost.sourceName || currentRemotePost.sourceHandle }}
                        <span class="remote-handle">{{ currentRemotePost.sourceHandle }}</span>
                    </a>
                    <span class="datetime">{{ formatDate(currentRemotePost.createdAt) }}</span>
                </div>

                <div v-if="currentRemotePost.summary && !showRemoteContent" class="remote-cw-gate">
                    <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="currentRemotePost.summary"></span></div>
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
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()

const { data: followingFeedData } = await useAsyncData(
    'following-feed',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getFollowingFeed`, { method: 'POST', body: { userid: userId.value } }).then(res => Array.isArray(res) ? res : [])
        : Promise.resolve([]),
    { watch: [userId] },
)

const followingFeed = computed(() => followingFeedData.value ?? [])

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

const currentView = ref('list')
const currentRemotePost = ref(null)
const showRemoteContent = ref(false)

function openRemotePost(post) {
    currentRemotePost.value = post
    showRemoteContent.value = false
    currentView.value = 'remote-detail'
}
</script>
