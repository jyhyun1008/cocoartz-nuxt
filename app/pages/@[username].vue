<script setup>
const route = useRoute()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()

const username = route.params.username

const { data: userData, refresh } = await useAsyncData(
    `user-profile-${username}`,
    () => $fetch(`${apiBaseUrl}/api/getUserProfile`, {
        method: 'POST',
        body: { username, viewerUserId: userId.value },
    }),
    { watch: [() => route.params.username] }
)

if (!userData.value) {
    throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })
}

const isOwn = computed(() => userId.value === userData.value?.id)

// 팔로우 토글
const followLoading = ref(false)
async function toggleFollow() {
    if (!userId.value || followLoading.value) return
    followLoading.value = true
    try {
        // 요청됨 상태도 unfollowUser로 취소(follows.accepted 여부와 무관하게 그냥 행을 지움)
        const endpoint = (userData.value?.isFollowing || userData.value?.isFollowRequested) ? 'unfollowUser' : 'followUser'
        await $fetch(`${apiBaseUrl}/api/${endpoint}`, {
            method: 'POST',
            body: { userid: userId.value, targetUsername: username },
        })
        await refresh()
    } finally {
        followLoading.value = false
    }
}

// 뮤트 — 소프트/하드 두 개 중 하나만 켜져 있을 수 있음(같은 버튼 다시 누르면 해제)
const muteLoading = ref(false)
async function toggleMute(level) {
    if (!userId.value || muteLoading.value) return
    muteLoading.value = true
    try {
        if (userData.value?.myMuteLevel === level) {
            await $fetch(`${apiBaseUrl}/api/unmuteUser`, {
                method: 'POST',
                body: { userid: userId.value, targetUserId: userData.value.id },
            })
        } else {
            await $fetch(`${apiBaseUrl}/api/muteUser`, {
                method: 'POST',
                body: { userid: userId.value, targetUserId: userData.value.id, level },
            })
        }
        await refresh()
    } finally {
        muteLoading.value = false
    }
}

const topLevelPosts = computed(() =>
    (userData.value?.posts ?? []).filter(p => !p.replyto)
)

const joinDate = computed(() => formatDateOnly(userData.value?.createdAt))

// 편집 모달
const showEdit = ref(false)
const editForm = reactive({ knownas: '', username: '', bio: '', avatar: '', banner: '' })
const editError = ref('')
const editLoading = ref(false)
const { enabled: objectStorageEnabled, ensureLoaded: ensureObjectStorageStatusLoaded } = useObjectStorageStatus()
const avatarFileInput = ref(null)
const avatarUploading = ref(false)
const bannerFileInput = ref(null)
const bannerUploading = ref(false)

async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    avatarUploading.value = true
    editError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('file', file)
        const result = await $fetch(`${apiBaseUrl}/api/uploadAvatar`, {
            method: 'POST',
            body: formData,
        })
        editForm.avatar = result.url
    } catch (err) {
        editError.value = err?.data?.message ?? '업로드에 실패했습니다'
    }
    avatarUploading.value = false
    e.target.value = ''
}

async function handleBannerFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    bannerUploading.value = true
    editError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('file', file)
        const result = await $fetch(`${apiBaseUrl}/api/uploadBanner`, {
            method: 'POST',
            body: formData,
        })
        editForm.banner = result.url
    } catch (err) {
        editError.value = err?.data?.message ?? '업로드에 실패했습니다'
    }
    bannerUploading.value = false
    e.target.value = ''
}

function openEdit() {
    editForm.knownas = userData.value?.knownas ?? ''
    editForm.username = userData.value?.username ?? ''
    editForm.bio = userData.value?.bio ?? ''
    editForm.avatar = userData.value?.avatar ?? ''
    editForm.banner = userData.value?.banner ?? ''
    editError.value = ''
    showEdit.value = true
    ensureObjectStorageStatusLoaded()
}

async function saveEdit() {
    editError.value = ''
    editLoading.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/updateProfile`, {
            method: 'POST',
            body: {
                userid: userId.value,
                knownas: editForm.knownas,
                bio: editForm.bio,
                avatar: editForm.avatar,
                banner: editForm.banner,
            },
        })
        showEdit.value = false
        await refresh()
    } catch (e) {
        editError.value = e?.data?.message ?? '저장 중 오류가 발생했습니다'
    } finally {
        editLoading.value = false
    }
}

// 팔로워/팔로잉 목록 모달
const showFollowList = ref(false)
const followListType = ref('followers')
const followListItems = ref([])
const followListLoading = ref(false)

async function loadFollowList() {
    followListLoading.value = true
    try {
        followListItems.value = await $fetch(`${apiBaseUrl}/api/getFollowList`, {
            method: 'POST',
            body: { username, type: followListType.value },
        })
    } finally {
        followListLoading.value = false
    }
}

function openFollowList(type) {
    followListType.value = type
    showFollowList.value = true
    loadFollowList()
}

function switchFollowListTab(type) {
    if (followListType.value === type) return
    followListType.value = type
    loadFollowList()
}
</script>

<template>
    <div id="profile-page">

        <!-- 상단 네비 바 -->
        <div id="profile-nav">
            <NuxtLink to="/" id="profile-back-btn">
                <i class="hgi hgi-stroke hgi-arrow-left-01"></i>
                서버로 돌아가기
            </NuxtLink>
            <span id="profile-nav-user">
                {{ userData?.knownas ?? userData?.username }}
                <span class="profile-nav-at">@{{ userData?.username }}</span>
            </span>
        </div>

        <!-- 메인 카드 -->
        <div id="profile-card-wrap">
            <div id="profile-card">

                <!-- 배너 + 아바타 -->
                <div id="profile-banner" :class="{ 'has-image': !!userData?.banner }">
                    <NuxtImg v-if="userData?.banner" :src="userData.banner" id="profile-banner-img" />
                </div>
                <div id="profile-avatar-row">
                    <div id="profile-avatar">
                        <NuxtImg v-if="userData?.avatar" :src="userData.avatar" class="avatar-img" />
                        <div v-else class="avatar-initial">
                            {{ (userData?.knownas ?? userData?.username ?? '?')[0] }}
                        </div>
                    </div>
                    <button v-if="isOwn" id="edit-profile-btn" @click="openEdit">프로필 편집</button>
                    <template v-else-if="userId">
                        <button
                            id="follow-btn"
                            :class="{ following: userData?.isFollowing, requested: userData?.isFollowRequested }"
                            :disabled="followLoading"
                            :title="userData?.isFollowRequested ? '클릭하면 요청을 취소합니다' : ''"
                            @click="toggleFollow"
                        >
                            {{ userData?.isFollowRequested ? '요청됨' : (userData?.isFollowing ? '팔로잉' : '팔로우') }}
                        </button>
                        <div id="mute-btn-group">
                            <button
                                class="mute-btn"
                                :class="{ active: userData?.myMuteLevel === 'soft' }"
                                :disabled="muteLoading"
                                title="소프트 뮤트 — 뮤트된 게시물입니다 게이트로 가림"
                                @click="toggleMute('soft')"
                            >소프트 뮤트</button>
                            <button
                                class="mute-btn"
                                :class="{ active: userData?.myMuteLevel === 'hard' }"
                                :disabled="muteLoading"
                                title="하드 뮤트 — 아예 안 보임"
                                @click="toggleMute('hard')"
                            >하드 뮤트</button>
                        </div>
                    </template>
                </div>

                <!-- 프로필 정보 -->
                <div id="profile-info">
                    <div id="profile-knownas">{{ userData?.knownas ?? userData?.username }}</div>
                    <div id="profile-username">@{{ userData?.username }}</div>
                    <div v-if="userData?.bio" id="profile-bio">{{ userData?.bio }}</div>
                    <div id="profile-meta">
                        <span><i class="hgi hgi-stroke hgi-calendar-01"></i> {{ joinDate }} 가입</span>
                        <button class="profile-stat-btn" @click="openFollowList('followers')"><strong>{{ userData?.followerCount ?? 0 }}</strong> 팔로워</button>
                        <button class="profile-stat-btn" @click="openFollowList('following')"><strong>{{ userData?.followingCount ?? 0 }}</strong> 팔로잉</button>
                    </div>
                </div>

                <!-- 개인 방 -->
                <div class="profile-section">
                    <div class="section-label">
                        <i class="hgi hgi-stroke hgi-home-07"></i> 개인 방
                    </div>
                    <UserRoomEmbed
                        :map-data="userData?.map ?? null"
                        :username="userData?.username ?? ''"
                        :is-own="isOwn"
                        :own-user-id="userId ?? 0"
                        @map-saved="refresh"
                    />
                </div>

                <!-- 게시글 타임라인 -->
                <div class="profile-section">
                    <div class="section-label">
                        <i class="hgi hgi-stroke hgi-grid"></i>
                        작성한 글 <span class="section-count">{{ topLevelPosts.length }}</span>
                    </div>

                    <div v-if="topLevelPosts.length" class="posts-list">
                        <NuxtLink v-for="post in topLevelPosts" :key="post.id" :to="`/post/${post.id}`" class="profile-post">
                            <div v-if="post.room" class="pp-room-tag">
                                <i class="hgi hgi-stroke hgi-grid"></i>
                                {{ post.room.knownas }}
                            </div>
                            <div class="pp-title">{{ post.title }}</div>
                            <div class="pp-content">{{ post.content }}</div>
                            <div class="pp-date">{{ formatDate(post.createdAt) }}</div>
                        </NuxtLink>
                    </div>
                    <div v-else class="profile-empty">아직 작성한 글이 없습니다.</div>
                </div>

            </div>
        </div>

        <!-- 프로필 편집 모달 -->
        <Teleport to="body">
            <div v-if="showEdit" class="edit-overlay" @click.self="showEdit = false">
                <div class="edit-modal">
                    <div class="edit-header">
                        <span>프로필 편집</span>
                        <button class="edit-close" @click="showEdit = false">✕</button>
                    </div>

                    <div class="edit-body">
                        <!-- 아바타 미리보기 -->
                        <div class="edit-avatar-preview">
                            <div class="edit-avatar-wrap">
                                <img v-if="editForm.avatar" :src="editForm.avatar" class="edit-avatar-img" @error="editForm.avatar = ''" />
                                <div v-else class="edit-avatar-initial">
                                    {{ (editForm.knownas || editForm.username || '?')[0] }}
                                </div>
                            </div>
                        </div>

                        <div class="edit-field">
                            <label>프로필 사진 URL</label>
                            <div class="edit-field-row">
                                <input v-model="editForm.avatar" type="url" placeholder="https://example.com/image.png" style="flex:1" />
                                <template v-if="objectStorageEnabled">
                                    <input type="file" ref="avatarFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleAvatarFile" />
                                    <button type="button" class="edit-upload-btn" @click="avatarFileInput?.click()" :disabled="avatarUploading">
                                        {{ avatarUploading ? '업로드 중...' : '업로드' }}
                                    </button>
                                </template>
                            </div>
                        </div>
                        <div class="edit-field">
                            <label>배너 이미지 URL</label>
                            <div class="edit-field-row">
                                <input v-model="editForm.banner" type="url" placeholder="https://example.com/banner.png" style="flex:1" />
                                <template v-if="objectStorageEnabled">
                                    <input type="file" ref="bannerFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleBannerFile" />
                                    <button type="button" class="edit-upload-btn" @click="bannerFileInput?.click()" :disabled="bannerUploading">
                                        {{ bannerUploading ? '업로드 중...' : '업로드' }}
                                    </button>
                                </template>
                            </div>
                        </div>
                        <div class="edit-field">
                            <label>닉네임</label>
                            <input v-model="editForm.knownas" type="text" placeholder="표시될 이름" />
                        </div>
                        <div class="edit-field">
                            <label>소개</label>
                            <textarea v-model="editForm.bio" placeholder="자기소개를 입력하세요..." rows="3"></textarea>
                        </div>

                        <p v-if="editError" class="edit-error">{{ editError }}</p>
                    </div>

                    <div class="edit-footer">
                        <button class="edit-cancel" @click="showEdit = false">취소</button>
                        <button class="edit-save" @click="saveEdit" :disabled="editLoading">
                            {{ editLoading ? '저장 중...' : '저장' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- 팔로워/팔로잉 목록 모달 -->
        <Teleport to="body">
            <div v-if="showFollowList" class="edit-overlay" @click.self="showFollowList = false">
                <div class="edit-modal follow-list-modal">
                    <div class="edit-header">
                        <div class="follow-list-tabs">
                            <button class="follow-list-tab" :class="{ active: followListType === 'followers' }" @click="switchFollowListTab('followers')">
                                팔로워 {{ userData?.followerCount ?? 0 }}
                            </button>
                            <button class="follow-list-tab" :class="{ active: followListType === 'following' }" @click="switchFollowListTab('following')">
                                팔로잉 {{ userData?.followingCount ?? 0 }}
                            </button>
                        </div>
                        <button class="edit-close" @click="showFollowList = false">✕</button>
                    </div>

                    <div class="follow-list-body">
                        <div v-if="followListLoading" class="follow-list-empty">불러오는 중...</div>
                        <template v-else-if="followListItems.length">
                            <template v-for="(item, i) in followListItems" :key="i">
                                <NuxtLink
                                    v-if="item.kind === 'local'"
                                    :to="`/@${item.username}`"
                                    class="follow-list-item"
                                    @click="showFollowList = false"
                                >
                                    <div class="follow-list-avatar">
                                        <img v-if="item.avatar" :src="item.avatar" />
                                        <span v-else>{{ (item.knownas || item.username || '?')[0] }}</span>
                                    </div>
                                    <div class="follow-list-info">
                                        <div class="follow-list-name">{{ item.knownas || item.username }}</div>
                                        <div class="follow-list-handle">@{{ item.username }}</div>
                                    </div>
                                </NuxtLink>
                                <a v-else :href="item.actorUrl" target="_blank" rel="noopener noreferrer" class="follow-list-item">
                                    <div class="follow-list-avatar">
                                        <img v-if="item.iconUrl" :src="item.iconUrl" />
                                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                                    </div>
                                    <div class="follow-list-info">
                                        <div class="follow-list-name">{{ item.name || item.handle }}</div>
                                        <div class="follow-list-handle">{{ item.handle }}</div>
                                    </div>
                                    <span v-if="followListType === 'following' && item.accepted === false" class="follow-list-pending">대기중</span>
                                </a>
                            </template>
                        </template>
                        <div v-else class="follow-list-empty">아직 없습니다.</div>
                    </div>
                </div>
            </div>
        </Teleport>

    </div>
</template>

<style scoped>
#profile-page {
    min-height: 100dvh;
    background-color: var(--page-bg);
    padding-bottom: 60px;
}

/* 상단 네비 바 */
#profile-nav {
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

#profile-back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255,255,255,0.8); /* 상단 네비바도 항상 악센트 색 배경이라 테마 무관하게 흰색 고정 */
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 400;
    transition: color 0.1s;
}
#profile-back-btn:hover { color: white; }

#profile-nav-user {
    display: flex;
    align-items: baseline;
    gap: 8px;
}
.profile-nav-at {
    font-size: 0.8rem;
    font-weight: 400;
    color: rgba(255,255,255,0.6); /* 상단 네비바도 항상 악센트 색 배경이라 테마 무관하게 흰색 고정 */
}

/* 카드 래퍼 */
#profile-card-wrap {
    display: flex;
    justify-content: center;
    padding: 10rem 20px 0;
}

#profile-card {
    width: 100%;
    max-width: 680px;
    background: var(--surface-0);
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(var(--fg-rgb),0.07);
}

/* 배너 */
#profile-banner {
    position: relative;
    overflow: hidden;
    aspect-ratio: 3;
    background: linear-gradient(135deg, var(--accent, #D21F3C) 0%, rgba(var(--accent-rgb, 210,31,60), 0.3) 100%);
    background-color: var(--accent, #D21F3C);
    opacity: 0.6;
}
#profile-banner.has-image { opacity: 1; }

#profile-banner-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* 아바타 */
#profile-avatar-row {
    padding: 0 24px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: -44px;
    margin-bottom: 12px;
    position: relative;
    z-index: 1;
}

#profile-avatar {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    border: 4px solid var(--surface-0);
    overflow: hidden;
    background: var(--surface-2);
    flex-shrink: 0;
}

.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.avatar-initial {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: 700;
    color: var(--accent, #D21F3C);
    background: var(--bgaccent, #D21F3C22);
}

#edit-profile-btn {
    background: none;
    border: 1px solid rgba(var(--fg-rgb),0.25);
    color: rgba(var(--fg-rgb),0.75);
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    margin-bottom: 4px;
    transition: border-color 0.15s, color 0.15s;
}
#edit-profile-btn:hover { border-color: rgba(var(--fg-rgb),0.5); color: rgba(var(--fg-rgb),1); }

#follow-btn {
    background-color: var(--accent, #D21F3C);
    border: 1px solid var(--accent, #D21F3C);
    color: white;
    border-radius: 20px;
    padding: 6px 18px;
    font-size: 0.85rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    margin-bottom: 4px;
    transition: opacity 0.15s, background-color 0.15s, color 0.15s;
}
#follow-btn:hover { opacity: 0.88; }
#follow-btn:disabled { opacity: 0.5; cursor: default; }

#follow-btn.following {
    background: none;
    color: rgba(var(--fg-rgb),0.75);
    border-color: rgba(var(--fg-rgb),0.25);
}
#follow-btn.following:hover {
    border-color: #ff6b6b;
    color: #ff6b6b;
}

#follow-btn.requested {
    background: none;
    color: rgba(var(--fg-rgb),0.4);
    border-color: rgba(var(--fg-rgb),0.2);
}
#follow-btn.requested:hover {
    border-color: #ff6b6b;
    color: #ff6b6b;
}

#mute-btn-group {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
}

.mute-btn {
    background: none;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    color: rgba(var(--fg-rgb),0.5);
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
}
.mute-btn:hover { border-color: rgba(var(--fg-rgb),0.35); color: rgba(var(--fg-rgb),0.85); }
.mute-btn:disabled { opacity: 0.5; cursor: default; }
.mute-btn.active {
    background: rgba(255,107,107,0.12);
    border-color: #ff6b6b;
    color: #ff6b6b;
}

/* 프로필 정보 */
#profile-info {
    padding: 0 24px 20px;
    color: rgba(var(--fg-rgb),0.85);
}

#profile-knownas {
    font-size: 1.3rem;
    font-weight: 700;
    line-height: 1.3;
}

#profile-username {
    font-size: 0.88rem;
    color: rgba(var(--fg-rgb),0.4);
    margin-bottom: 8px;
}

#profile-bio {
    font-size: 0.95rem;
    color: rgba(var(--fg-rgb),0.7);
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
    margin-bottom: 10px;
}

#profile-meta {
    font-size: 0.82rem;
    color: rgba(var(--fg-rgb),0.35);
    display: flex;
    gap: 14px;
    align-items: center;
}

#profile-meta i { vertical-align: middle; }

.profile-stat-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.82rem;
    font-family: inherit;
    color: rgba(var(--fg-rgb),0.35);
    cursor: pointer;
    transition: color 0.1s;
}
.profile-stat-btn:hover { color: rgba(var(--fg-rgb),0.75); }
.profile-stat-btn:hover strong { text-decoration: underline; }
.profile-stat-btn strong { color: inherit; }

/* 공통 섹션 */
.profile-section {
    padding: 0 20px 24px;
}

.section-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(var(--fg-rgb),0.35);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.section-count {
    background: rgba(var(--fg-rgb),0.1);
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 0.72rem;
}

/* 게시글 */
.posts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.profile-post {
    display: block;
    background: rgba(var(--fg-rgb),0.04);
    border: 1px solid rgba(var(--fg-rgb),0.07);
    border-radius: 10px;
    padding: 14px 16px;
    cursor: pointer;
    transition: background 0.1s;
    text-decoration: none;
}

.profile-post:hover { background: rgba(var(--fg-rgb),0.07); }

.pp-room-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.35);
    margin-bottom: 4px;
}

.pp-title {
    font-weight: 700;
    font-size: 0.95rem;
    color: rgba(var(--fg-rgb),0.85);
    margin-bottom: 4px;
}

.pp-content {
    font-size: 0.88rem;
    color: rgba(var(--fg-rgb),0.5);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.pp-date {
    font-size: 0.75rem;
    color: rgba(var(--fg-rgb),0.28);
    margin-top: 6px;
}

.profile-empty {
    color: rgba(var(--fg-rgb),0.28);
    font-size: 0.9rem;
    padding: 16px 0;
}

/* 편집 모달 */
.edit-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.edit-modal {
    width: 100%;
    max-width: 440px;
    background: var(--surface-0);
    border-radius: 16px;
    border: 1px solid rgba(var(--fg-rgb),0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    font-weight: 700;
    font-size: 1rem;
    color: rgba(var(--fg-rgb),0.9);
    border-bottom: 1px solid rgba(var(--fg-rgb),0.07);
}

.edit-close {
    background: none;
    border: none;
    color: rgba(var(--fg-rgb),0.4);
    font-size: 1rem;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
    transition: color 0.1s;
}
.edit-close:hover { color: rgba(var(--fg-rgb),0.9); }

.edit-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
    max-height: 70vh;
}

.edit-avatar-preview {
    display: flex;
    justify-content: center;
    padding-bottom: 4px;
}

.edit-avatar-wrap {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid rgba(var(--fg-rgb),0.1);
    background: var(--surface-2);
}

.edit-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.edit-avatar-initial {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--accent, #D21F3C);
    background: var(--bgaccent, #D21F3C22);
}

.edit-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.edit-field label {
    font-size: 0.78rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.4);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.edit-field input,
.edit-field textarea {
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 0.92rem;
    font-family: inherit;
    background: rgba(var(--fg-rgb),0.05);
    color: rgba(var(--fg-rgb),0.88);
    transition: border-color 0.15s, background 0.15s;
    resize: vertical;
}
.edit-field-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.edit-upload-btn {
    flex-shrink: 0;
    background: rgba(var(--fg-rgb),0.1);
    border: 1px solid rgba(var(--fg-rgb),0.15);
    color: rgba(var(--fg-rgb),0.8);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
}
.edit-upload-btn:hover { background: rgba(var(--fg-rgb),0.18); }
.edit-upload-btn:disabled { opacity: 0.5; cursor: default; }

.edit-field input::placeholder,
.edit-field textarea::placeholder { color: rgba(var(--fg-rgb),0.22); }
.edit-field input:focus,
.edit-field textarea:focus {
    outline: none;
    border-color: var(--accent, #D21F3C);
    background: rgba(var(--fg-rgb),0.08);
}

.edit-error {
    font-size: 0.85rem;
    color: #ff6b6b;
    margin: 0;
    padding: 8px 12px;
    background: rgba(255,107,107,0.1);
    border-radius: 8px;
    border: 1px solid rgba(255,107,107,0.2);
}

.edit-footer {
    display: flex;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid rgba(var(--fg-rgb),0.07);
    justify-content: flex-end;
}

.edit-cancel {
    background: none;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    color: rgba(var(--fg-rgb),0.6);
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 0.9rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
}
.edit-cancel:hover { border-color: rgba(var(--fg-rgb),0.35); color: rgba(var(--fg-rgb),0.9); }

.edit-save {
    background-color: var(--accent, #D21F3C);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 22px;
    font-size: 0.9rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s;
}
.edit-save:hover { opacity: 0.88; }
.edit-save:disabled { opacity: 0.4; cursor: default; }

/* 팔로워/팔로잉 목록 모달 */
.follow-list-modal { max-width: 400px; }

.follow-list-tabs {
    display: flex;
    gap: 4px;
}

.follow-list-tab {
    background: none;
    border: none;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-family: inherit;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.4);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
}
.follow-list-tab:hover { color: rgba(var(--fg-rgb),0.75); }
.follow-list-tab.active {
    background: rgba(var(--fg-rgb),0.08);
    color: rgba(var(--fg-rgb),0.95);
}

.follow-list-body {
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    overflow-y: auto;
    padding: 6px;
}

.follow-list-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: background 0.1s;
}
.follow-list-item:hover { background: rgba(var(--fg-rgb),0.06); }

.follow-list-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bgaccent, #D21F3C22);
    color: var(--accent, #D21F3C);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
}
.follow-list-avatar img { width: 100%; height: 100%; object-fit: cover; }

.follow-list-info { min-width: 0; flex: 1; }

.follow-list-name {
    font-size: 0.92rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.9);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.follow-list-handle {
    font-size: 0.8rem;
    color: rgba(var(--fg-rgb),0.4);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.follow-list-pending {
    flex-shrink: 0;
    font-size: 0.7rem;
    color: rgba(var(--fg-rgb),0.45);
    background: rgba(var(--fg-rgb),0.08);
    border-radius: 4px;
    padding: 2px 7px;
}

.follow-list-empty {
    color: rgba(var(--fg-rgb),0.3);
    font-size: 0.9rem;
    padding: 30px 0;
    text-align: center;
}
</style>
