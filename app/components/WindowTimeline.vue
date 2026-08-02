<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-globe-02"></i>
            <span class="board-header-title">연합 타임라인</span>
            <div class="board-header-actions">
                <button class="window-close-btn board-close-btn" @click="$emit('close')">✕</button>
            </div>
        </div>

        <div id="timeline-content">
            <!-- 팔로잉 피드 (로컬 유저끼리 팔로우한 글 모아보기) -->
            <div v-if="isLoggedIn" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">팔로잉 피드</span>
                </div>
                <div v-for="p in followingFeed" :key="p.id" class="timeline-post">
                    <div class="timeline-post-meta">
                        <div class="admin-icon-preview" style="width:32px;height:32px;border-radius:50%">
                            <NuxtImg v-if="p.isRemote ? p.sourceIconUrl : p.user?.avatar" :src="p.isRemote ? p.sourceIconUrl : p.user.avatar" class="admin-icon-preview-img" />
                            <i v-else class="hgi hgi-stroke hgi-user-group"></i>
                        </div>
                        <div class="timeline-post-author">
                            <template v-if="p.isRemote">
                                <a :href="p.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="post-author">{{ p.sourceName || p.sourceHandle }}</a>
                                <span class="remote-handle">{{ p.sourceHandle }}</span>
                            </template>
                            <NuxtLink v-else :to="p.user?.username ? `/@${p.user.username}` : '#'" class="post-author">{{ p.user?.knownas ?? p.user?.username }}</NuxtLink>
                        </div>
                        <span class="datetime">{{ formatDate(p.createdAt) }}</span>
                    </div>
                    <template v-if="p.isRemote">
                        <div v-if="p.summary" class="timeline-cw">
                            <i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="p.summary"></span>
                        </div>
                        <div class="timeline-post-body" v-html="p.content"></div>
                    </template>
                    <NuxtLink v-else :to="`/post/${p.id}`" class="timeline-post-body" style="color:inherit;text-decoration:none;display:block">
                        <strong>{{ p.title }}</strong>
                    </NuxtLink>
                </div>
                <div v-if="!followingFeed.length" class="empty" style="padding:14px 0">아직 팔로우한 사람이 없거나, 팔로우한 사람이 쓴 글이 없습니다.</div>

                <div class="admin-section-header" style="margin-top:18px">
                    <span class="admin-section-title">팔로우 중인 원격 계정</span>
                </div>
                <div class="admin-icon-row">
                    <input v-model="remoteFollowHandle" placeholder="user@mastodon.social" class="post-input" style="flex:1" @keydown.enter="submitRemoteFollow" />
                    <button class="admin-add-btn" style="margin-left:0" @click="submitRemoteFollow" :disabled="!remoteFollowHandle.trim() || remoteFollowSaving">
                        {{ remoteFollowSaving ? '팔로우 중...' : '팔로우' }}
                    </button>
                </div>
                <p v-if="remoteFollowError" class="admin-error">{{ remoteFollowError }}</p>

                <div class="admin-channel-list" style="margin-top:10px">
                    <div v-for="f in remoteFollowsList" :key="f.id" class="admin-channel-item">
                        <div class="admin-icon-preview" style="width:28px;height:28px;border-radius:50%">
                            <NuxtImg v-if="f.targetIconUrl" :src="f.targetIconUrl" class="admin-icon-preview-img" />
                            <i v-else class="hgi hgi-stroke hgi-user-group"></i>
                        </div>
                        <span class="admin-ch-name">{{ f.targetName || f.targetHandle }}</span>
                        <code class="admin-ch-path">{{ f.targetHandle }}</code>
                        <span class="admin-ch-type-badge" :class="{ 'admin-ch-federated-badge': f.accepted }">
                            {{ f.accepted ? '팔로잉' : '대기중' }}
                        </span>
                        <div class="admin-ch-actions">
                            <button class="admin-icon-btn danger" @click="unfollowRemote(f.id)" title="언팔로우">
                                <i class="hgi hgi-stroke hgi-delete-02"></i>
                            </button>
                        </div>
                    </div>
                    <div v-if="!remoteFollowsList.length" class="empty" style="padding:14px 0">아직 팔로우한 원격 계정이 없습니다.</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()

const { data: followingFeedData, refresh: refreshFollowingFeed } = await useAsyncData(
    'following-feed',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getFollowingFeed`, { method: 'POST', body: { userid: userId.value } }).then(res => Array.isArray(res) ? res : [])
        : Promise.resolve([]),
    { watch: [userId] },
)
const { data: remoteFollowsData, refresh: refreshRemoteFollows } = await useAsyncData(
    'remote-follows',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getRemoteFollows`, { method: 'POST', body: { userid: userId.value } }).then(res => Array.isArray(res) ? res : [])
        : Promise.resolve([]),
    { watch: [userId] },
)

const followingFeed = computed(() => followingFeedData.value ?? [])
const remoteFollowsList = computed(() => remoteFollowsData.value ?? [])


const remoteFollowHandle = ref('')
const remoteFollowSaving = ref(false)
const remoteFollowError = ref('')

async function submitRemoteFollow() {
    if (!remoteFollowHandle.value.trim()) return
    remoteFollowSaving.value = true
    remoteFollowError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/followRemoteUser`, {
            method: 'POST',
            body: { userid: userId.value, handle: remoteFollowHandle.value.trim() },
        })
        remoteFollowHandle.value = ''
        await refreshRemoteFollows()
    } catch (e) {
        remoteFollowError.value = e?.data?.message ?? '팔로우에 실패했습니다'
    }
    remoteFollowSaving.value = false
}

async function unfollowRemote(id) {
    try {
        await $fetch(`${apiBaseUrl}/api/unfollowRemoteUser`, {
            method: 'POST',
            body: { userid: userId.value, id },
        })
        await refreshRemoteFollows()
        await refreshFollowingFeed()
    } catch (e) {
        remoteFollowError.value = e?.data?.message ?? '언팔로우에 실패했습니다'
    }
}
</script>

<style>
#timeline-content {
    padding: 20px 24px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    font-size: 0.95rem;
}

.timeline-post {
    padding: 12px 0;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.07);
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.timeline-post-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.timeline-post-author {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
}

.timeline-post-body {
    color: rgba(var(--fg-rgb),0.8);
    line-height: 1.7;
    font-size: 0.92rem;
}

.timeline-post-body img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    display: block;
    margin: 6px 0;
}

/* 리모트 커스텀 이모지(:shortcode:) — 본문 사진과 달리 글자 크기에 맞춰 인라인으로 */
img.custom-emoji {
    display: inline-block;
    width: 1.35em;
    height: 1.35em;
    max-width: 1.35em;
    border-radius: 0;
    margin: 0 0.05em;
    vertical-align: middle;
    transition: transform 0.15s ease;
}
img.custom-emoji:hover {
    transform: scale(1.8);
}

.timeline-post-body p { margin: 0.5em 0; }
.timeline-post-body p:first-child { margin-top: 0; }
.timeline-post-body p:last-child { margin-bottom: 0; }

.timeline-cw {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 0.9rem;
    color: #ffb454;
}
</style>
