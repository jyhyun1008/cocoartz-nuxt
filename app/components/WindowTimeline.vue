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
                        <div v-else-if="!p.isRemote" class="post-card" @click="navigateTo(`/post/${p.id}`)">
                            <div class="post-card-title">{{ p.title }}</div>
                            <div class="post-card-meta">
                                <NuxtLink :to="p.user?.username ? `/@${p.user.username}` : '#'" class="post-author user-name-link" @click.stop>
                                    <NuxtImg v-if="p.user?.avatar" class="avatar avatar-sm" :src="p.user.avatar" />
                                    <div v-else class="avatar avatar-placeholder avatar-sm">{{ (p.user?.knownas ?? p.user?.username ?? '?')[0] }}</div>
                                    {{ p.user?.knownas ?? p.user?.username }}
                                </NuxtLink>
                                <span class="datetime">{{ formatDate(p.createdAt) }}</span>
                            </div>
                            <button v-if="p.muted === 'soft'" class="cw-hide-btn" @click.stop="revealedMuted[p.id] = false">
                                <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                            </button>
                        </div>
                        <!-- 원격 글: 미리보기 카드, 클릭하면 상세보기 -->
                        <div
                            v-else
                            class="post-card external-post-card"
                            :style="{ borderLeftColor: badgeBg(remoteServerHost(p.sourceActorUrl)) }"
                            @click="openRemotePost(p)"
                        >
                            <div class="external-post-body">
                                <div v-if="p.boostedByName || p.boostedByHandle" class="boost-banner">
                                    <i class="hgi hgi-stroke hgi-arrow-reload-horizontal"></i>
                                    <span class="boost-banner-text">
                                        <span v-if="p.boostedByName" v-html="p.boostedByName"></span><span v-else>{{ p.boostedByHandle }}</span>님이 재게시했습니다
                                    </span>
                                </div>
                                <div class="post-card-title">
                                    <i class="hgi hgi-stroke hgi-globe-02"></i>
                                    <!-- 코코아츠 서버끼리 연합한 글의 summary는 진짜 CW가 아니라 그쪽 게시판
                                         글 제목이라(publishPost.ts 참고) 경고 아이콘 없이 제목처럼 보여줌.
                                         제목은 한 줄이어야 하니 원본에 줄바꿈이 있어도 한 줄로 합침(singleLine) -->
                                    <template v-if="p.summary && p.summaryIsTitle">
                                        <span class="title-text" v-html="singleLine(p.summary)"></span>
                                    </template>
                                    <template v-else-if="p.summary">
                                        <i class="hgi hgi-stroke hgi-alert-02 cw-icon" title="열람주의(CW)"></i>
                                        <span class="title-text" v-html="singleLine(p.summary)"></span>
                                    </template>
                                    <span
                                        v-else
                                        class="title-text preview-text"
                                        v-html="stripHtmlKeepEmoji(p.content, p.quoteUrl || p.linkUrl, p.quoteUrl ? '[인용]' : '[링크]')"
                                    ></span>
                                </div>
                                <div class="post-card-meta">
                                    <NuxtLink :to="remoteProfilePath(p.sourceHandle)" class="post-author remote-handle" @click.stop>
                                        <NuxtImg v-if="p.sourceIconUrl" class="avatar avatar-sm" :src="p.sourceIconUrl" />
                                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                                        <span v-if="p.sourceName" v-html="p.sourceName"></span>
                                        <span v-else>{{ p.sourceHandle }}</span>
                                    </NuxtLink>
                                    <span class="datetime">{{ formatDate(p.createdAt) }}</span>
                                </div>
                                <button v-if="p.muted === 'soft'" class="cw-hide-btn" @click.stop="revealedMuted[p.id] = false">
                                    <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                                </button>
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
                <!-- 상세보기는 목록 카드처럼 좁게 자를 필요가 없어서(공간 충분) 한 줄 말줄임(ellipsis)은
                     빼고, "이름 + 님이 재게시했습니다"를 하나의 flex item으로만 묶어 흐름이 안 끊기게 함 -->
                <div v-if="currentRemotePost.boostedByName || currentRemotePost.boostedByHandle" class="boost-banner">
                    <i class="hgi hgi-stroke hgi-arrow-reload-horizontal"></i>
                    <span class="boost-banner-text boost-banner-text-wrap">
                        <span v-if="currentRemotePost.boostedByName" v-html="currentRemotePost.boostedByName"></span><span v-else>{{ currentRemotePost.boostedByHandle }}</span>님이 재게시했습니다
                    </span>
                </div>
                <div class="post-meta">
                    <NuxtLink :to="remoteProfilePath(currentRemotePost.sourceHandle)" class="post-author remote-author">
                        <NuxtImg v-if="currentRemotePost.sourceIconUrl" class="avatar avatar-sm" :src="currentRemotePost.sourceIconUrl" />
                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                        <span v-if="currentRemotePost.sourceName" v-html="currentRemotePost.sourceName"></span>
                        <span v-else>{{ currentRemotePost.sourceHandle }}</span>
                        <span class="remote-handle">{{ currentRemotePost.sourceHandle }}</span>
                    </NuxtLink>
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

                <!-- 코코아츠 서버끼리 연합한 글은 summary가 진짜 CW가 아니라 게시판 글 제목이라
                     (publishPost.ts 참고) 가리지 않고 제목처럼 그대로 보여줌 -->
                <div v-if="currentRemotePost.summary && currentRemotePost.summaryIsTitle" class="post-title-large" v-html="currentRemotePost.summary"></div>

                <div v-if="currentRemotePost.summary && !currentRemotePost.summaryIsTitle && !showRemoteContent" class="remote-cw-gate">
                    <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="currentRemotePost.summary"></span></div>
                    <button class="submit-btn" @click="showRemoteContent = true">내용 보기</button>
                </div>
                <template v-else>
                    <div class="post-content md-content" v-html="stripEmbeddedLink(currentRemotePost.content, currentRemotePost.quoteUrl || currentRemotePost.linkUrl)"></div>
                    <button v-if="currentRemotePost.summary && !currentRemotePost.summaryIsTitle" class="cw-hide-btn" @click="showRemoteContent = false">
                        <i class="hgi hgi-stroke hgi-alert-02"></i> 다시 숨기기
                    </button>
                </template>

                <!-- 인용글 임베드 -->
                <a
                    v-if="quotedPost"
                    :href="quotedPost.objectId"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="quote-embed-card"
                >
                    <div class="quote-embed-header">
                        <NuxtImg v-if="quotedPost.sourceIconUrl" class="avatar avatar-sm" :src="quotedPost.sourceIconUrl" />
                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                        <span v-if="quotedPost.sourceName" v-html="quotedPost.sourceName"></span>
                        <span v-else>{{ quotedPost.sourceHandle }}</span>
                        <span class="remote-handle">{{ quotedPost.sourceHandle }}</span>
                    </div>
                    <div v-if="quotedPost.summary" class="quote-embed-body"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="quotedPost.summary"></span></div>
                    <div v-else class="quote-embed-body" v-html="quotedPost.content"></div>
                </a>
                <a
                    v-else-if="currentRemotePost.quoteUrl"
                    :href="currentRemotePost.quoteUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="quote-embed-card quote-embed-fallback"
                >
                    인용된 글 보기 <i class="hgi hgi-stroke hgi-arrow-up-right-01"></i>
                </a>

                <!-- 링크 미리보기 / 유튜브·사운드클라우드 임베드 -->
                <div v-else-if="linkPreview && (linkPreview.embedUrl || linkPreview.title || linkPreview.imageUrl)" class="link-preview-card">
                    <iframe
                        v-if="linkPreview.embedUrl && (linkPreview.kind === 'youtube' || linkPreview.kind === 'soundcloud')"
                        :src="linkPreview.embedUrl"
                        class="embed-iframe"
                        :class="linkPreview.kind"
                        frameborder="0"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowfullscreen
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                    ></iframe>
                    <a v-else :href="linkPreview.url" target="_blank" rel="noopener noreferrer" class="link-preview-body">
                        <NuxtImg v-if="linkPreview.imageUrl" :src="linkPreview.imageUrl" class="link-preview-image" />
                        <div class="link-preview-text">
                            <div v-if="linkPreview.title" class="link-preview-title">{{ linkPreview.title }}</div>
                            <div v-if="linkPreview.description" class="link-preview-desc">{{ linkPreview.description }}</div>
                            <div class="link-preview-site">{{ linkPreview.siteName || remoteServerHost(linkPreview.url) }}</div>
                        </div>
                    </a>
                </div>

                <div v-if="userId" class="post-meta">
                    <button class="like-btn" :class="{ liked: currentRemotePost.liked }" @click="toggleRemoteLike">
                        ♥ {{ currentRemotePost.liked ? '좋아요 취소' : '좋아요' }}
                    </button>
                    <span v-if="likeError" class="admin-error" style="padding:4px 8px">{{ likeError }}</span>
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
                                    <NuxtLink :to="remoteProfilePath(comment.remoteActorHandle)" class="post-author remote-author" title="fediverse 프로필로 이동">
                                        <NuxtImg v-if="comment.remoteActorIconUrl" class="avatar avatar-sm" :src="comment.remoteActorIconUrl" />
                                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                                        <span v-if="comment.remoteActorName" v-html="comment.remoteActorName"></span>
                                        <span v-else>{{ comment.remoteActorHandle }}</span>
                                        <span class="remote-handle">{{ comment.remoteActorHandle }}</span>
                                    </NuxtLink>
                                </template>
                                <NuxtLink v-else :to="comment.user?.username ? `/@${comment.user.username}` : '#'" class="post-author user-name-link">
                                    <NuxtImg v-if="comment.user?.avatar" class="avatar avatar-sm" :src="comment.user.avatar" />
                                    <div v-else class="avatar avatar-placeholder avatar-sm">{{ (comment.user?.knownas ?? comment.user?.username ?? '?')[0] }}</div>
                                    {{ comment.user?.knownas ?? comment.user?.username }}
                                </NuxtLink>
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
                            <div v-if="comment.summary && !revealedCw[`reply-${comment.id}`]" class="remote-cw-gate">
                                <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="comment.summary"></span></div>
                                <button class="submit-btn" @click="revealedCw[`reply-${comment.id}`] = true">내용 보기</button>
                            </div>
                            <template v-else>
                                <div v-if="comment.remoteActorHandle" class="comment-body remote" v-html="stripLeadingMentions(comment.content)"></div>
                                <div v-else class="comment-body" v-html="withCustomEmoji(escapeHtml(comment.content))"></div>
                                <button v-if="comment.summary" class="cw-hide-btn" @click="revealedCw[`reply-${comment.id}`] = false">
                                    <i class="hgi hgi-stroke hgi-alert-02"></i> 다시 숨기기
                                </button>
                            </template>
                            <button v-if="comment.muted === 'soft'" class="cw-hide-btn" @click="revealedMuted[`reply-${comment.id}`] = false">
                                <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                            </button>
                        </template>
                    </div>
                    <div class="empty" v-if="!remoteReplies.length">댓글이 없습니다.</div>
                </div>

                <template v-if="userId">
                    <p v-if="writeBlocked" class="admin-error">
                        <i class="hgi hgi-stroke hgi-mail-validation-02"></i> 이메일 인증을 완료해야 댓글을 쓸 수 있어요.
                        <NuxtLink to="/preferences" style="color:inherit;text-decoration:underline">내 설정에서 인증하기</NuxtLink>
                    </p>
                    <p v-if="remoteReplyError" class="admin-error">{{ remoteReplyError }}</p>
                    <div class="comment-form">
                        <input v-model="remoteReplyContent" placeholder="댓글(답글로 전달됨) 작성..." class="post-input" :disabled="writeBlocked" @keydown.enter="submitRemoteReply" />
                        <button class="submit-btn" @click="submitRemoteReply" :disabled="!remoteReplyContent.trim() || writeBlocked">작성</button>
                    </div>
                </template>
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

// 원격 팔로우 계정 글에 댓글/좋아요를 하면 항상 그 계정 서버로 실제 배포됨 — 연합 게시판과 동일한
// 이유로 이메일 인증한 유저만 가능하게 막아둠. 여기도 작성 단계에서 미리 알 수 있게 배너 + 입력
// 비활성화로 보여줌
const { data: emailVerificationData } = await useAsyncData(
    'timeline-email-verification-status',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getEmailVerificationStatus`, { method: 'POST', body: { userid: userId.value } })
        : Promise.resolve({ required: false, verified: true }),
    { watch: [userId] },
)
const writeBlocked = computed(() => {
    const d = emailVerificationData.value
    return !!d?.required && !d?.verified
})

// 우리 서버 커스텀 이모지(:shortcode:) — 원격글 상세의 로컬 댓글 표시 시점에 치환
// (WindowBoard.vue에는 이미 있는데 여기는 빠져 있었음)
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
function withCustomEmoji(html) {
    return renderCustomEmojiText(html, customEmojiMap.value)
}

// 뮤트 — WindowBoard.vue와 동일한 패턴(소프트: 게이트+"그래도 보기", 하드: 서버가 애초에 안 내려줌)
const activeMuteKey = ref(null)
const revealedMuted = ref({})
// CW(요약/스포일러) 공개 여부 — WindowBoard.vue와 동일한 이유(다시 숨기기가 가능해야 해서 토글)
const revealedCw = ref({})
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
    ensureCustomEmojisLoaded()
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
    await catchUpSources()
}

await loadFirstPage()
watch(userId, loadFirstPage)

async function fetchLocalMore() {
    if (!hasMoreLocal.value) return
    const nextOffset = localOffset.value + PAGE_SIZE
    const res = await fetchFeedPage(nextOffset, remoteOffset.value)
    localOffset.value = nextOffset
    localItems.value = [...localItems.value, ...(res.localPosts ?? [])]
    hasMoreLocal.value = res.hasMoreLocal ?? false
}

async function fetchRemoteMore() {
    if (!hasMoreRemote.value) return
    const nextOffset = remoteOffset.value + PAGE_SIZE
    const res = await fetchFeedPage(localOffset.value, nextOffset)
    remoteOffset.value = nextOffset
    remoteItems.value = [...remoteItems.value, ...(res.remotePosts ?? [])]
    hasMoreRemote.value = res.hasMoreRemote ?? false
}

// 로컬 팔로우 글은 원격 팔로우 firehose보다 훨씬 뜨문뜨문해서, 그냥 각자 PAGE_SIZE(20)씩
// 독립적으로 가져오면 로컬 글들이 이번에 새로 불러온 배치의 오래된 쪽 끝(=더보기 버튼 근처)에
// 몰려 보이는 문제가 있었음(WindowBoard.vue 게시판 목록과 동일한 원인) — 두 소스가 "커버한
// 시점"이 서로 비슷해질 때까지 더 뒤처진 쪽을 반복해서 따라잡음
function oldestSortDate(list) {
    if (!list.length) return null
    return new Date(list[list.length - 1].sortDate).getTime()
}

const MAX_CATCHUP_FETCHES = 6

async function catchUpSources() {
    const initTasks = []
    if (hasMoreLocal.value && !localItems.value.length) initTasks.push(fetchLocalMore())
    if (hasMoreRemote.value && !remoteItems.value.length) initTasks.push(fetchRemoteMore())
    if (initTasks.length) await Promise.all(initTasks)

    for (let i = 0; i < MAX_CATCHUP_FETCHES; i++) {
        const localOldest = oldestSortDate(localItems.value)
        const remoteOldest = oldestSortDate(remoteItems.value)
        if (localOldest === null && remoteOldest === null) break

        if (localOldest !== null && remoteOldest !== null) {
            if (localOldest > remoteOldest && hasMoreLocal.value) await fetchLocalMore()
            else if (remoteOldest > localOldest && hasMoreRemote.value) await fetchRemoteMore()
            else break
        } else if (localOldest === null && hasMoreLocal.value) {
            await fetchLocalMore()
        } else if (remoteOldest === null && hasMoreRemote.value) {
            await fetchRemoteMore()
        } else {
            break
        }
    }
}

async function loadMore() {
    if (loadingMore.value) return
    loadingMore.value = true
    try {
        const tasks = []
        if (hasMoreLocal.value) tasks.push(fetchLocalMore())
        if (hasMoreRemote.value) tasks.push(fetchRemoteMore())
        await Promise.all(tasks)
        await catchUpSources()
    } finally {
        loadingMore.value = false
    }
}

const hasMoreToShow = computed(() => hasMoreLocal.value || hasMoreRemote.value)

const followingFeed = computed(() =>
    [...localItems.value, ...remoteItems.value].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()),
)

// 개인 타임라인 실시간 스트리밍(server/routes/_ws.ts의 broadcastTimelineNewPost) — 새로고침 없이
// 맨 앞에 바로 꽂아 넣음. WindowBoard.vue의 federatedPostFeed 처리와 동일한 패턴(배열 자체를
// 히스토리로 재생하지 않고 "바뀔 때마다 맨 뒤(방금 도착한 것)만" 봄)이라, kind에 따라
// localItems/remoteItems 중 맞는 쪽에만 꽂아 넣어야 followingFeed 병합·정렬이 그대로 맞음
const { timelinePostFeed } = useRoomSocket()
const { playUpdateSound } = useSoundEffects()
watch(timelinePostFeed, (feed) => {
    if (!feed.length) return
    const entry = feed[feed.length - 1]
    if (!entry?.post) return
    if (entry.kind === 'local') {
        if (localItems.value.some((p) => p.id === entry.post.id)) return
        localItems.value = [entry.post, ...localItems.value]
    } else {
        if (remoteItems.value.some((p) => p.id === entry.post.id)) return
        remoteItems.value = [entry.post, ...remoteItems.value]
    }
    playUpdateSound()
})

// summaryIsTitle로 취급하는 원격 CW 텍스트는 "게시글 제목"인데, 원본 CW는 마스토돈/미스키 등에서
// 여러 줄로 써도 되는 자유 텍스트라 <br>/개행이 그대로 들어있는 경우가 있음(WindowBoard.vue와 동일 이유)
function singleLine(html) {
    if (!html) return ''
    return html.replace(/<br\s*\/?>/gi, ' ').replace(/\n+/g, ' ')
}

// 제목/미리보기 줄에서도 커스텀 이모지(:shortcode:)는 살리고 나머지 태그만 지움 (WindowBoard.vue와 동일 로직)
// embedUrl(인용/링크 대상 URL)이 있으면 본문 속 그 <a href>를 통째로 작은 칩으로 바꿔서
// 목록 미리보기에 원본 URL이 그대로 노출되지 않게 함 — 본문에 그 링크가 안 보이는 경우(예:
// 인용 필드가 content 텍스트엔 안 들어있는 구현체)엔 칩을 미리보기 끝에 덧붙임
function stripHtmlKeepEmoji(html, embedUrl, embedLabel) {
    if (!html) return ''
    const emojiTags = []
    let processed = html.replace(/<img[^>]*class="[^"]*custom-emoji[^"]*"[^>]*>/g, (match) => {
        emojiTags.push(match)
        return ` EMOJI${emojiTags.length - 1} `
    })
    let chipInlined = false
    if (embedUrl) {
        const escaped = embedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // 미스키 등이 인용 링크 앞에 붙이는 "RE:" 표시도 칩으로 같이 치환(링크만 지우면 "RE:"만 남아 어색해짐)
        processed = processed.replace(new RegExp(`(?:RE:?\\s*)?<a\\s[^>]*href=["']${escaped}["'][^>]*>[\\s\\S]*?</a>`, 'i'), () => {
            chipInlined = true
            return ' EMBEDCHIP '
        })
    }
    const stripped = processed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    let result = stripped.replace(/ EMOJI(\d+) /g, (_, i) => emojiTags[Number(i)])
    if (embedUrl) {
        const chip = `<span class="preview-embed-chip">${embedLabel}</span>`
        result = chipInlined ? result.replace('EMBEDCHIP', chip) : (result ? `${result} ${chip}` : chip)
    }
    return result
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
const quotedPost = ref(null)
const linkPreview = ref(null)

async function openRemotePost(post) {
    currentRemotePost.value = post
    showRemoteContent.value = false
    remoteReplyContent.value = ''
    currentView.value = 'remote-detail'
    quotedPost.value = null
    linkPreview.value = null
    await refreshRemoteReplies()
    loadEmbed(post)
}

// 인용글/링크 미리보기 — 목록에서는 배지만 보여주고, 상세 화면 열 때만 실제로 가져옴
async function loadEmbed(post) {
    if (post.quoteUrl) {
        quotedPost.value = await $fetch(`${apiBaseUrl}/api/getQuotedPost`, {
            method: 'POST',
            body: { quoteUrl: post.quoteUrl },
        }).catch(() => null)
    } else if (post.linkUrl) {
        linkPreview.value = await $fetch(`${apiBaseUrl}/api/getLinkPreview`, {
            method: 'POST',
            body: { url: post.linkUrl },
        }).catch(() => null)
    }
}

async function refreshRemoteReplies() {
    if (!currentRemotePost.value) return
    remoteReplies.value = await $fetch(`${apiBaseUrl}/api/getRemoteFeedPostReplies`, {
        method: 'POST',
        body: { objectId: currentRemotePost.value.objectId, viewerUserId: userId.value ?? null },
    }).catch(() => [])
}

const likeError = ref('')

async function toggleRemoteLike() {
    if (!currentRemotePost.value) return
    likeError.value = ''
    let result
    try {
        result = await $fetch(`${apiBaseUrl}/api/likeFollowingFeedPost`, {
            method: 'POST',
            body: { id: currentRemotePost.value.feedPostId, userid: userId.value },
        })
    } catch (e) {
        likeError.value = e?.data?.message ?? '좋아요 처리에 실패했습니다'
        return
    }
    currentRemotePost.value.liked = result.liked
}

const remoteReplyError = ref('')

async function submitRemoteReply() {
    if (!remoteReplyContent.value.trim() || !currentRemotePost.value) return
    remoteReplyError.value = ''
    const content = remoteReplyContent.value.trim()
    try {
        const reply = await $fetch(`${apiBaseUrl}/api/replyToFollowingFeedPost`, {
            method: 'POST',
            body: {
                userid: userId.value,
                feedPostId: currentRemotePost.value.feedPostId,
                content,
            },
        })
        remoteReplies.value = [...remoteReplies.value, reply]
    } catch (e) {
        remoteReplyError.value = e?.data?.message ?? '댓글 작성에 실패했습니다'
        return
    }
    remoteReplyContent.value = ''
}
</script>
