<script setup>
import { avatarPartFromCategory } from '../../lib/shopCategories'
import { DEFAULT_CHARACTER } from '../composables/useCharacter'

const route = useRoute()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()

// ⚠️ computed로 둬야 함 — 같은 페이지 컴포넌트로 매핑되는 라우트끼리(예: /@alice → /@bob)는
// Vue Router가 컴포넌트 인스턴스를 재사용하고 <script setup>을 다시 안 돌림. 예전엔 이걸 그냥
// const로 route.params.username을 한 번만 읽어서, 프로필 링크를 타고 다른 유저 프로필로
// 넘어가도(주소창은 바뀌지만) useAsyncData의 키/body가 계속 처음 들어왔을 때의 username을
// 써서 실제로는 항상 같은(맨 처음 봤던) 프로필 데이터만 다시 불러오는 버그가 있었음 —
// 그래서 남의 프로필 URL인데 내 방이 그대로 보이고 편집(꾸미기)까지 가능해 보였음.
const username = computed(() => route.params.username)

// ⚠️ 키 자체를 username에 물려서 씀(고정 문자열 키 + watch 조합 말고) — 키가 고정이면 Nuxt의
// getCachedData 기본 동작(payloadExtraction/static 캐시)이 조건에 따라 "같은 키니까 이전 값
// 재사용"으로 판단할 여지가 남아있어서, 프로필을 옮겨다녀도 예전 데이터가 계속 보일 수 있음.
// 키에 username을 직접 포함시키면 유저가 바뀌는 순간 완전히 새로운 키가 되어 그 문제 자체가
// 없고, 한 번 봤던 프로필로 돌아가면 오히려 캐시를 재사용해 더 빠르게 뜨는 보너스도 있음.
const { data: userData, refresh } = await useAsyncData(
    () => `user-profile-${username.value}`,
    () => $fetch(`${apiBaseUrl}/api/getUserProfile`, {
        method: 'POST',
        body: { username: username.value, viewerUserId: userId.value },
    }),
)

if (!userData.value) {
    throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })
}

const isOwn = computed(() => !userData.value?.isRemote && userId.value === userData.value?.id)

// /@username@host — 프로필 상단의 "@..." 표시는 리모트일 땐 인스턴스까지 포함한 전체 핸들로
const atHandle = computed(() => userData.value?.isRemote ? userData.value.handle : `@${userData.value?.username ?? ''}`)

// 아바타 이니셜(프사 없을 때 대체) 전용 — 리모트 계정의 knownas는 그 서버 커스텀 이모지 <img>가
// 섞인 HTML이라(아래 참고) 첫 글자만 잘라 쓰면 태그가 깨져 보일 수 있어서, 이니셜만큼은 항상
// username(순수 텍스트)에서 뽑음
const initialChar = computed(() => {
    const base = (userData.value?.isRemote ? userData.value?.username : (userData.value?.knownas ?? userData.value?.username)) ?? '?'
    return base[0] ?? '?'
})

// 팔로우 토글 — 로컬 유저는 followUser/unfollowUser, 리모트(fediverse) 계정은
// followRemoteUser/unfollowRemoteUser로 완전히 다른 API를 씀(로컬은 users.id, 리모트는
// remoteFollows 행의 id로 식별)
const followLoading = ref(false)
async function toggleFollow() {
    if (!userId.value || followLoading.value) return
    followLoading.value = true
    try {
        if (userData.value?.isRemote) {
            if (userData.value?.isFollowing || userData.value?.isFollowRequested) {
                await $fetch(`${apiBaseUrl}/api/unfollowRemoteUser`, {
                    method: 'POST',
                    body: { userid: userId.value, id: userData.value.followId },
                })
            } else {
                await $fetch(`${apiBaseUrl}/api/followRemoteUser`, {
                    method: 'POST',
                    body: { userid: userId.value, handle: userData.value.handle },
                })
            }
        } else {
            // 요청됨 상태도 unfollowUser로 취소(follows.accepted 여부와 무관하게 그냥 행을 지움)
            const endpoint = (userData.value?.isFollowing || userData.value?.isFollowRequested) ? 'unfollowUser' : 'followUser'
            await $fetch(`${apiBaseUrl}/api/${endpoint}`, {
                method: 'POST',
                body: { userid: userId.value, targetUsername: username.value },
            })
        }
        await refresh()
    } catch (err) {
        alert(err?.data?.message ?? '처리 중 오류가 발생했습니다')
    } finally {
        followLoading.value = false
    }
}

// 뮤트 — 소프트/하드 두 개 중 하나만 켜져 있을 수 있음(같은 버튼 다시 누르면 해제).
// 버튼 두 개를 항상 펼쳐두면 모바일에서 팔로우 버튼까지 셋이 줄줄이 붙어 너무 커 보여서,
// "..." 버튼 뒤 드롭다운으로 접어둠(RoomMap.vue/post/[postId].vue의 채팅·게시물 뮤트 메뉴와 같은 패턴)
// muteUser/unmuteUser는 이미 targetUserId(로컬)/targetActorUrl(리모트) 둘 다 지원해서 그대로 재사용
const muteLoading = ref(false)
const muteMenuOpen = ref(false)
async function toggleMute(level) {
    if (!userId.value || muteLoading.value) return
    muteLoading.value = true
    try {
        const targetField = userData.value?.isRemote
            ? { targetActorUrl: userData.value.actorUrl }
            : { targetUserId: userData.value.id }
        if (userData.value?.myMuteLevel === level) {
            await $fetch(`${apiBaseUrl}/api/unmuteUser`, {
                method: 'POST',
                body: { userid: userId.value, ...targetField },
            })
        } else {
            await $fetch(`${apiBaseUrl}/api/muteUser`, {
                method: 'POST',
                body: { userid: userId.value, ...targetField, level },
            })
        }
        await refresh()
    } finally {
        muteLoading.value = false
        muteMenuOpen.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mute-action-wrap')) muteMenuOpen.value = false
    })
})

const topLevelPosts = computed(() =>
    (userData.value?.posts ?? []).filter(p => !p.replyto)
)

const joinDate = computed(() => formatDateOnly(userData.value?.createdAt))

// 인벤토리 — 본인 프로필일 때만 조회(getMyInventory 자체가 본인 것만 내려줌)
const { mainTabs: invMainTabs, avatarSubTabs: invAvatarSubTabs, itemSubTabs: invItemSubTabs } = useShopCategories()
const invMainTab = ref('avatar')
const invCurrentSubTabs = computed(() => invMainTab.value === 'avatar' ? invAvatarSubTabs : invItemSubTabs)
const invSubTab = ref(invAvatarSubTabs[0]?.id ?? '')
watch(invMainTab, () => { invSubTab.value = invCurrentSubTabs.value[0]?.id ?? '' })

const { data: inventoryData } = await useAsyncData(
    'my-inventory',
    () => (isOwn.value && userId.value)
        ? $fetch(`${apiBaseUrl}/api/getMyInventory`, { method: 'POST', body: { userid: userId.value } })
        : [],
    // getMyInventory는 세션 쿠키가 있어야 하는데 SSR 중 $fetch는 쿠키를 안 실어 보내서(위
    // useCurrentUserData.ts와 같은 문제) 강제새로고침 때 서버 내부에서만 401이 나고 그게 브라우저
    // 네트워크 탭엔 안 잡힌 채로 빈 인벤토리가 굳어버림 — server:false로 클라이언트에서만 fetch
    { watch: [isOwn], server: false },
)
const inventory = computed(() => inventoryData.value ?? [])
const visibleInventory = computed(() => inventory.value.filter(i => i.category === invSubTab.value))

// 아바타 장착 — 인벤토리에서 보유한 아바타 아이템을 누르면 바로 장착됨(지금 장착 중인 건 accent
// 테두리로 표시). 새 저장소 없이 이미 있던 users.character를 그대로 씀 — 가입 시 기본 파츠를
// 전원이 이미 보유 상태로 지급받아둬서(server/db/seedShopItems.ts) 이행 문제가 따로 없음.
const { userData: currentUserData, invalidate: invalidateCurrentUserData, ensureLoaded: ensureCurrentUserDataLoaded } = useCurrentUserData()
// RoomMap.vue/UserRoomEmbed.vue와 같은 문제: await 없이 그냥 호출만 하면 SSR 렌더링이 이
// 요청을 기다려주지 않아서(응답 오기 전에 이미 렌더 끝남) 새로고침 시 장착 아이템이 잠깐
// 기본값으로 보였다가 나중에 바뀌는 깜빡임이 생김 — top-level await로 렌더 전에 끝나게 함
await ensureCurrentUserDataLoaded()

const equippedConfig = computed(() => {
    let cfg = { ...DEFAULT_CHARACTER }
    try {
        if (currentUserData.value?.character) cfg = { ...cfg, ...JSON.parse(currentUserData.value.character) }
    } catch {}
    // equipAvatarItem.ts는 outfit 장착 시 저장된 config에서 bottom/top을 지워서 상호배타를
    // 표현하는데, 여기서 DEFAULT_CHARACTER를 다시 깔아버리면 지워진 자리에 기본 하의/상의(1번)가
    // 부활해서 한벌옷과 하의/상의가 동시에 "장착 중"으로 표시됨 — outfit이 있으면 항상 미장착 취급
    if (cfg.outfit) {
        cfg.bottom = null
        cfg.top = null
    }
    return cfg
})
function isEquipped(item) {
    const part = avatarPartFromCategory(item.category)
    return !!part && equippedConfig.value[part] === Number(item.itemKey)
}
// outfit(한벌옷)/deco(데코)는 body/hair 등과 달리 "안 낌"도 유효한 상태라 있음/없음을 토글할 수
// 있어야 함 — 이미 장착 중인 걸 다시 누르면 해제(unequipAvatarItem)되게 함. 나머지 필수 슬롯은
// 항상 뭔가 껴있어야 해서 이미 장착 중인 걸 눌러도 그냥 무시(기존 그대로)
const UNEQUIPPABLE_PARTS = ['outfit', 'deco']
const equippingId = ref(null)
async function equipItem(item) {
    const part = avatarPartFromCategory(item.category)
    if (!part || equippingId.value) return
    if (isEquipped(item)) {
        if (!UNEQUIPPABLE_PARTS.includes(part)) return
        equippingId.value = item.itemid
        try {
            await $fetch(`${apiBaseUrl}/api/unequipAvatarItem`, {
                method: 'POST',
                body: { userid: userId.value, category: item.category },
            })
            invalidateCurrentUserData()
            await ensureCurrentUserDataLoaded()
        } catch (err) {
            alert(err?.data?.message ?? '해제에 실패했습니다')
        } finally {
            equippingId.value = null
        }
        return
    }
    equippingId.value = item.itemid
    try {
        await $fetch(`${apiBaseUrl}/api/equipAvatarItem`, {
            method: 'POST',
            body: { userid: userId.value, category: item.category, itemKey: item.itemKey },
        })
        invalidateCurrentUserData()
        await ensureCurrentUserDataLoaded()
    } catch (err) {
        alert(err?.data?.message ?? '장착에 실패했습니다')
    } finally {
        equippingId.value = null
    }
}

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
        // 하단 프로필바(ServerProfilebar.vue)가 별도 캐시 키('i-data')로 내 정보를 들고 있어서,
        // 이 페이지 자체 refresh()만으로는 프로필바의 아바타/닉네임이 갱신되지 않음
        await refreshNuxtData('i-data')
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
            body: { username: username.value, type: followListType.value },
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
                <span v-if="userData?.isRemote" v-html="userData.knownas"></span>
                <template v-else>{{ userData?.knownas ?? userData?.username }}</template>
                <span class="profile-nav-at">{{ atHandle }}</span>
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
                            {{ initialChar }}
                        </div>
                    </div>
                    <button v-if="isOwn" id="edit-profile-btn" @click="openEdit">프로필 편집</button>
                    <div v-else-if="userId" id="profile-actions">
                        <button
                            id="follow-btn"
                            :class="{ following: userData?.isFollowing, requested: userData?.isFollowRequested }"
                            :disabled="followLoading"
                            :title="userData?.isFollowRequested ? '클릭하면 요청을 취소합니다' : ''"
                            @click="toggleFollow"
                        >
                            {{ userData?.isFollowRequested ? '요청됨' : (userData?.isFollowing ? '팔로잉' : '팔로우') }}
                        </button>
                        <div class="mute-action-wrap">
                            <button
                                class="mute-more-btn"
                                :class="{ 'active-mute': userData?.myMuteLevel }"
                                title="뮤트"
                                @click.stop="muteMenuOpen = !muteMenuOpen"
                            >
                                <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                            </button>
                            <div v-if="muteMenuOpen" class="mute-menu" @click.stop>
                                <button
                                    :class="{ active: userData?.myMuteLevel === 'soft' }"
                                    :disabled="muteLoading"
                                    title="뮤트된 게시물입니다 게이트로 가림"
                                    @click="toggleMute('soft')"
                                >소프트 뮤트</button>
                                <button
                                    :class="{ active: userData?.myMuteLevel === 'hard' }"
                                    :disabled="muteLoading"
                                    title="아예 안 보임"
                                    @click="toggleMute('hard')"
                                >하드 뮤트</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 프로필 정보 -->
                <div id="profile-info">
                    <div id="profile-knownas">
                        <span v-if="userData?.isRemote" v-html="userData.knownas"></span>
                        <template v-else>{{ userData?.knownas ?? userData?.username }}</template>
                        <span v-if="userData?.isRemote" class="remote-badge" title="다른 서버(fediverse)의 계정입니다">
                            <i class="hgi hgi-stroke hgi-globe-02"></i> 리모트
                        </span>
                    </div>
                    <div id="profile-username">{{ atHandle }}</div>
                    <div v-if="userData?.bio" id="profile-bio">
                        <span v-if="userData?.isRemote" v-html="userData.bio"></span>
                        <template v-else>{{ userData?.bio }}</template>
                    </div>
                    <div id="profile-meta">
                        <span v-if="joinDate"><i class="hgi hgi-stroke hgi-calendar-01"></i> {{ joinDate }} 가입</span>
                        <template v-if="!userData?.isRemote">
                            <button class="profile-stat-btn" @click="openFollowList('followers')"><strong>{{ userData?.followerCount ?? 0 }}</strong> 팔로워</button>
                            <button class="profile-stat-btn" @click="openFollowList('following')"><strong>{{ userData?.followingCount ?? 0 }}</strong> 팔로잉</button>
                        </template>
                        <a v-else :href="userData.externalUrl" target="_blank" rel="noopener noreferrer" class="profile-stat-btn">
                            <i class="hgi hgi-stroke hgi-link-01"></i> 원본 프로필
                        </a>
                    </div>
                </div>

                <!-- 개인 방 (리모트 유저는 이 서버에 방이 없음) -->
                <div v-if="!userData?.isRemote" class="profile-section">
                    <div class="section-label">
                        <i class="hgi hgi-stroke hgi-home-07"></i> 개인 방
                    </div>
                    <UserRoomEmbed
                        :map-data="userData?.map ?? null"
                        :username="userData?.username ?? ''"
                        :is-own="isOwn"
                        :own-user-id="userId ?? 0"
                        :owner-character="userData?.character ?? null"
                        @map-saved="refresh"
                    />
                </div>

                <!-- 인벤토리 (본인만) -->
                <div v-if="isOwn" class="profile-section">
                    <div class="section-label">
                        <i class="hgi hgi-stroke hgi-package"></i>
                        인벤토리 <span class="section-count">{{ inventory.length }}</span>
                        <NuxtLink to="/shop" class="inv-shop-link"><i class="hgi hgi-stroke hgi-shopping-bag-01"></i> 상점</NuxtLink>
                    </div>

                    <div class="admin-tabs">
                        <button
                            v-for="tab in invMainTabs" :key="tab.id" class="admin-tab-btn"
                            :class="{ active: invMainTab === tab.id }" @click="invMainTab = tab.id"
                        >
                            <i :class="tab.icon"></i> {{ tab.label }}
                        </button>
                    </div>
                    <div class="admin-tabs shop-subtabs">
                        <button
                            v-for="tab in invCurrentSubTabs" :key="tab.id" class="admin-tab-btn"
                            :class="{ active: invSubTab === tab.id }" @click="invSubTab = tab.id"
                        >
                            {{ tab.label }}
                        </button>
                    </div>

                    <div v-if="visibleInventory.length" class="shop-grid">
                        <div
                            v-for="item in visibleInventory" :key="item.itemid" class="shop-card"
                            :class="{ 'shop-card-clickable': avatarPartFromCategory(item.category), 'shop-card-equipped': isEquipped(item) }"
                            :title="avatarPartFromCategory(item.category) ? (isEquipped(item) ? (UNEQUIPPABLE_PARTS.includes(avatarPartFromCategory(item.category)) ? '눌러서 해제' : '장착 중') : '눌러서 장착') : ''"
                            @click="avatarPartFromCategory(item.category) && equipItem(item)"
                        >
                            <div class="shop-card-icon">
                                <AvatarPartIcon v-if="avatarPartFromCategory(item.category)" :part="avatarPartFromCategory(item.category)" :variant="item.itemKey" :size="56" />
                                <NuxtImg v-else-if="item.icon" :src="item.icon" />
                                <i v-else class="hgi hgi-stroke hgi-package" />
                            </div>
                            <div class="shop-card-name">{{ item.name }}</div>
                            <div v-if="isEquipped(item)" class="shop-owned-count shop-equipped-label">
                                <i class="hgi hgi-stroke hgi-checkmark-circle-01"></i> 장착 중
                            </div>
                            <div v-else-if="item.count >= 1" class="shop-owned-count">{{ item.count }}개 보유</div>
                        </div>
                    </div>
                    <div v-else class="profile-empty">이 카테고리엔 보유한 아이템이 없습니다.</div>
                </div>

                <!-- 게시글 타임라인 -->
                <div class="profile-section">
                    <div class="section-label">
                        <i class="hgi hgi-stroke hgi-grid"></i>
                        작성한 글 <span v-if="!userData?.isRemote" class="section-count">{{ topLevelPosts.length }}</span>
                        <!-- 리모트 계정은 전체 글이 아니라 우리 서버 연합 타임라인에 떴던 글만 모은
                        best-effort 목록이라 별도로 안내 -->
                        <span v-if="userData?.isRemote" class="pp-remote-note">(이 서버 연합 타임라인에서 확인된 글만)</span>
                    </div>

                    <div v-if="topLevelPosts.length" class="posts-list">
                        <template v-if="userData?.isRemote">
                            <a
                                v-for="post in topLevelPosts" :key="post.id" :href="post.objectId"
                                target="_blank" rel="noopener noreferrer" class="profile-post"
                            >
                                <div v-if="post.title" class="pp-title">{{ post.title }}</div>
                                <div class="pp-content">{{ post.content }}</div>
                                <div class="pp-date">{{ formatDate(post.published) }}</div>
                            </a>
                        </template>
                        <template v-else>
                            <NuxtLink v-for="post in topLevelPosts" :key="post.id" :to="`/post/${post.id}`" class="profile-post">
                                <div v-if="post.room" class="pp-room-tag">
                                    <i class="hgi hgi-stroke hgi-grid"></i>
                                    {{ post.room.knownas }}
                                </div>
                                <div class="pp-title">{{ post.title }}</div>
                                <div class="pp-content">{{ post.content }}</div>
                                <div class="pp-date">{{ formatDate(post.createdAt) }}</div>
                            </NuxtLink>
                        </template>
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
                                        <div v-if="item.name" class="follow-list-name" v-html="item.name"></div>
                                        <div v-else class="follow-list-name">{{ item.handle }}</div>
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

/* 팔로우 버튼이 space-between 때문에 아바타-뮤트 사이 어중간한 자리에 홀로 떨어져 보이던 문제 —
   팔로우+뮤트를 한 그룹으로 묶어서 오른쪽 끝에 같이 붙게 함(아바타는 왼쪽, 이 그룹은 오른쪽) */
#profile-actions {
    display: flex;
    align-items: center;
    gap: 6px;
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

.mute-action-wrap {
    position: relative;
    margin-bottom: 4px;
}

.mute-more-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    color: rgba(var(--fg-rgb),0.5);
    border-radius: 50%;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.15s;
}
.mute-more-btn:hover { border-color: rgba(var(--fg-rgb),0.35); color: rgba(var(--fg-rgb),0.85); }
.mute-more-btn.active-mute {
    background: rgba(255,107,107,0.12);
    border-color: #ff6b6b;
    color: #ff6b6b;
}

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
.mute-menu button:disabled { opacity: 0.5; cursor: default; }
.mute-menu button.active { color: #ff6b6b; font-weight: 600; }

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

.remote-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--accent);
    background: rgba(var(--accent-rgb, 210,31,60),0.12);
    border-radius: 8px;
    padding: 2px 7px;
    vertical-align: middle;
    margin-left: 4px;
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
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

.pp-remote-note {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.28);
}

.inv-shop-link {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    text-transform: none;
    letter-spacing: normal;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
}
.inv-shop-link:hover { text-decoration: underline; }

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
    /* input/textarea는 flex 자식일 때 기본 min-width가 auto라서, 버튼과 한 줄에 있으면
       내용 크기 밑으로 안 줄어들고 좁은 화면에서 행 전체를 밀어버림 — 항상 줄어들 수 있게 함 */
    min-width: 0;
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
    flex-wrap: wrap;
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
.follow-list-name :deep(img.custom-emoji) {
    display: inline-block;
    width: 1.2em;
    height: 1.2em;
    max-width: 1.2em;
    border-radius: 0;
    margin: 0 0.05em;
    vertical-align: middle;
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
