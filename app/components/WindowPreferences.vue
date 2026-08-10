<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-user-settings-01"></i>
            <span class="board-header-title">내 설정</span>
            <div class="board-header-actions">
                <button class="window-close-btn board-close-btn" @click="$emit('close')">✕</button>
            </div>
        </div>

        <div id="preferences-content">
            <!-- 테마 -->
            <div class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">화면 테마</span>
                </div>
                <div class="pref-theme-row">
                    <span class="pref-theme-label">{{ theme === 'dark' ? '다크 모드' : '라이트 모드' }}</span>
                    <button class="pref-theme-btn" type="button" @click="toggleTheme">
                        <i class="hgi hgi-stroke" :class="theme === 'dark' ? 'hgi-sun-01' : 'hgi-moon-02'"></i>
                        {{ theme === 'dark' ? '라이트로 전환' : '다크로 전환' }}
                    </button>
                </div>
            </div>

            <!-- 이메일 인증 — 이 서버가 SMTP를 설정해서 인증을 요구할 때만(required) 뜸.
                 로그인/글쓰기를 막는 강제 게이트가 아니라 배지 + 재전송 버튼만 있는 소프트한 안내 -->
            <div v-if="isLoggedIn && emailVerificationRequired && !emailVerified" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">이메일 인증</span>
                </div>
                <div class="pref-theme-row">
                    <span class="pref-theme-label"><i class="hgi hgi-stroke hgi-alert-02" style="color:#ff9f43"></i> 아직 이메일 인증을 안 하셨어요</span>
                    <button class="pref-theme-btn" type="button" :disabled="resendSaving || resendCooldown" @click="resendVerification">
                        {{ resendSaving ? '전송 중...' : (resendCooldown ? '전송됨' : '인증 메일 재전송') }}
                    </button>
                </div>
                <p v-if="resendError" class="admin-error" style="margin-top:8px">{{ resendError }}</p>
                <p v-if="resendSent" class="admin-label-hint" style="margin-top:8px">가입 시 보낸 메일함(스팸함 포함)을 확인해주세요. 새로 전송했어요.</p>
            </div>

            <!-- 팔로우 승인 -->
            <template v-if="isLoggedIn">
                <div class="admin-section">
                    <div class="admin-section-header">
                        <span class="admin-section-title">팔로우 승인</span>
                    </div>
                    <div class="pref-theme-row">
                        <span class="pref-theme-label">새 팔로우를 수동으로 승인</span>
                        <button class="pref-theme-btn" type="button" :disabled="approvalSettingSaving" @click="toggleRequireApproval">
                            <i class="hgi hgi-stroke" :class="requireFollowApproval ? 'hgi-checkmark-circle-01' : 'hgi-circle'"></i>
                            {{ requireFollowApproval ? '켜짐' : '꺼짐' }}
                        </button>
                    </div>
                    <p class="admin-label-hint" style="margin:6px 0 0">
                        켜두면 팔로우 요청(로컬/원격 모두)이 바로 승인되지 않고 아래 목록에 쌓여서, 직접 승인/거절해야 팔로워로 반영돼요. 꺼두면 지금처럼 자동 승인됩니다.
                    </p>

                    <div class="admin-channel-list" style="margin-top:14px">
                        <div v-for="p in pendingFollows" :key="p.id" class="admin-channel-item">
                            <div class="admin-icon-preview" style="width:28px;height:28px;border-radius:50%">
                                <NuxtImg v-if="p.kind === 'remote' ? p.iconUrl : p.avatar" :src="p.kind === 'remote' ? p.iconUrl : p.avatar" />
                                <i v-else class="hgi hgi-stroke hgi-user-group"></i>
                            </div>
                            <span v-if="p.kind === 'remote' && p.name" class="admin-ch-name" v-html="p.name"></span>
                            <span v-else class="admin-ch-name">{{ p.kind === 'remote' ? p.handle : (p.knownas || p.username) }}</span>
                            <code class="admin-ch-path">{{ p.kind === 'remote' ? p.handle : `@${p.username}` }}</code>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn" @click="respondFollow(p.id, true)" title="승인">
                                    <i class="hgi hgi-stroke hgi-tick-01"></i>
                                </button>
                                <button class="admin-icon-btn danger" @click="respondFollow(p.id, false)" title="거절">
                                    <i class="hgi hgi-stroke hgi-cancel-01"></i>
                                </button>
                            </div>
                        </div>
                        <div v-if="!pendingFollows.length" class="empty" style="padding:14px 0">대기 중인 팔로우 요청이 없습니다.</div>
                    </div>
                </div>
            </template>

            <!-- 원격 계정 팔로우 -->
            <template v-if="isLoggedIn">
                <div class="admin-section">
                    <div class="admin-section-header">
                        <span class="admin-section-title">팔로우 중인 원격 계정</span>
                    </div>
                    <p class="admin-label-hint" style="margin:-4px 0 10px">
                        fediverse(마스토돈/미스키 등) 계정을 팔로우하면 <NuxtLink to="/timeline" style="color:var(--accent)">타임라인</NuxtLink>에 글이 모여요.
                    </p>
                    <p v-if="emailVerificationRequired && !emailVerified" class="admin-error">
                        <i class="hgi hgi-stroke hgi-mail-validation-02"></i> 팔로우는 상대 서버로 실제 요청이 나가서, 이메일 인증을 완료해야 할 수 있어요.
                    </p>
                    <div class="admin-icon-row">
                        <input
                            v-model="remoteFollowHandle" placeholder="user@mastodon.social" class="post-input" style="flex:1"
                            :disabled="emailVerificationRequired && !emailVerified" @keydown.enter="submitRemoteFollow"
                        />
                        <button
                            class="admin-add-btn" style="margin-left:0" @click="submitRemoteFollow"
                            :disabled="!remoteFollowHandle.trim() || remoteFollowSaving || (emailVerificationRequired && !emailVerified)"
                        >
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
                            <span v-if="f.targetName" class="admin-ch-name" v-html="f.targetName"></span>
                            <span v-else class="admin-ch-name">{{ f.targetHandle }}</span>
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

                <!-- 뮤트 목록 -->
                <div class="admin-section">
                    <div class="admin-section-header">
                        <span class="admin-section-title">뮤트 목록</span>
                    </div>
                    <p class="admin-label-hint" style="margin:-4px 0 10px">
                        게시판/타임라인/채팅에서 뮤트한 사람들이에요. 소프트 뮤트는 "뮤트된 게시물입니다" 게이트로 가려지고, 하드 뮤트는 아예 안 보여요.
                    </p>
                    <div class="admin-channel-list">
                        <div v-for="m in mutesList" :key="m.id" class="admin-channel-item">
                            <div class="admin-icon-preview" style="width:28px;height:28px;border-radius:50%">
                                <NuxtImg v-if="m.kind === 'remote' ? m.iconUrl : m.avatar" :src="m.kind === 'remote' ? m.iconUrl : m.avatar" />
                                <i v-else class="hgi hgi-stroke hgi-user-group"></i>
                            </div>
                            <span v-if="m.kind === 'remote' && m.name" class="admin-ch-name" v-html="m.name"></span>
                            <span v-else class="admin-ch-name">{{ m.kind === 'remote' ? m.handle : (m.knownas || m.username) }}</span>
                            <code class="admin-ch-path">{{ m.kind === 'remote' ? m.handle : `@${m.username}` }}</code>
                            <span class="admin-ch-type-badge" :class="{ 'admin-ch-federated-badge': m.level === 'hard' }">
                                {{ m.level === 'hard' ? '하드 뮤트' : '소프트 뮤트' }}
                            </span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn danger" @click="unmute(m)" title="뮤트 해제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </div>
                        <div v-if="!mutesList.length" class="empty" style="padding:14px 0">뮤트한 사람이 없습니다.</div>
                    </div>
                </div>

                <!-- 단어/정규식 뮤트 -->
                <div class="admin-section">
                    <div class="admin-section-header">
                        <span class="admin-section-title">단어 뮤트</span>
                    </div>
                    <p class="admin-label-hint" style="margin:-4px 0 10px">
                        작성자가 누구든, 등록해둔 단어(또는 정규식)가 제목·본문·채팅에 있으면 걸러줘요. 소프트 뮤트는 "뮤트된 게시물입니다" 게이트로 가려지고, 하드 뮤트는 아예 안 보여요.
                    </p>
                    <div class="admin-icon-row">
                        <input v-model="newWordMutePattern" placeholder="단어 또는 정규식" class="post-input" style="flex:1" @keydown.enter="submitWordMute" />
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;white-space:nowrap">
                            <input type="checkbox" v-model="newWordMuteIsRegex" /> 정규식
                        </label>
                        <select v-model="newWordMuteLevel" class="admin-select" style="max-width:110px">
                            <option value="soft">소프트</option>
                            <option value="hard">하드</option>
                        </select>
                        <button class="admin-add-btn" style="margin-left:0" @click="submitWordMute" :disabled="!newWordMutePattern.trim() || wordMuteSaving">
                            {{ wordMuteSaving ? '추가 중...' : '추가' }}
                        </button>
                    </div>
                    <p v-if="wordMuteError" class="admin-error">{{ wordMuteError }}</p>

                    <div class="admin-channel-list" style="margin-top:10px">
                        <div v-for="w in wordMutesList" :key="w.id" class="admin-channel-item">
                            <i class="hgi hgi-stroke hgi-quote-up admin-ch-icon" style="opacity:0.4"></i>
                            <code class="admin-ch-name">{{ w.pattern }}</code>
                            <span v-if="w.isRegex" class="admin-ch-type-badge">정규식</span>
                            <span class="admin-ch-type-badge" :class="{ 'admin-ch-federated-badge': w.level === 'hard' }">
                                {{ w.level === 'hard' ? '하드 뮤트' : '소프트 뮤트' }}
                            </span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn danger" @click="removeWordMute(w.id)" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </div>
                        <div v-if="!wordMutesList.length" class="empty" style="padding:14px 0">등록한 단어 뮤트가 없습니다.</div>
                    </div>
                </div>

                <!-- 커스텀 이모지 뮤트 -->
                <div class="admin-section">
                    <div class="admin-section-header">
                        <span class="admin-section-title">커스텀 이모지 뮤트</span>
                    </div>
                    <p class="admin-label-hint" style="margin:-4px 0 10px">
                        보고 싶지 않은 커스텀 이모지를 뮤트해두면, 글·댓글·채팅 본문에 그 샷코드(:shortcode:)가 있을 때 "뮤트된 게시물입니다" 게이트로 가려져요. 리액션으로 달려있으면 게이트 없이 아예 안 보여요. 어느 서버 이모지든 샷코드 문자열만 같으면 걸려요 — 이 서버 이모지는 아래에서 클릭으로, 다른(원격) 서버 이모지는 샷코드를 직접 입력해서 뮤트할 수 있어요.
                    </p>

                    <div class="emoji-mute-grid">
                        <button
                            v-for="e in customEmojiList"
                            :key="e.shortcode"
                            type="button"
                            class="emoji-mute-item"
                            :class="{ muted: mutedShortcodes.has(e.shortcode) }"
                            :title="`:${e.shortcode}:`"
                            @click="toggleEmojiMute(e.shortcode)"
                        >
                            <NuxtImg :src="e.imageUrl" class="emoji-mute-img" />
                            <i v-if="mutedShortcodes.has(e.shortcode)" class="hgi hgi-stroke hgi-volume-mute-01 emoji-mute-badge"></i>
                        </button>
                        <div v-if="!customEmojiList.length" class="empty" style="padding:14px 0">등록된 커스텀 이모지가 없습니다.</div>
                    </div>

                    <label class="admin-label" style="margin-top:14px">다른 서버(원격) 이모지 직접 추가</label>
                    <div class="admin-icon-row">
                        <input
                            v-model="newEmojiMuteShortcode"
                            placeholder="샷코드 (콜론 없이, 예: blobcat)"
                            class="post-input"
                            style="flex:1"
                            @keydown.enter="submitEmojiMuteByShortcode"
                        />
                        <button class="admin-add-btn" style="margin-left:0" :disabled="!newEmojiMuteShortcode.trim()" @click="submitEmojiMuteByShortcode">
                            추가
                        </button>
                    </div>
                    <p v-if="emojiMuteError" class="admin-error">{{ emojiMuteError }}</p>

                    <!-- 위 그리드에 없는(=이 서버에 등록 안 된, 즉 원격) 뮤트 목록만 따로 표시 -->
                    <div v-if="remoteMutedEmojis.length" class="admin-channel-list" style="margin-top:10px">
                        <div v-for="m in remoteMutedEmojis" :key="m.id" class="admin-channel-item">
                            <i class="hgi hgi-stroke hgi-globe-02 admin-ch-icon" style="opacity:0.4"></i>
                            <code class="admin-ch-name">:{{ m.shortcode }}:</code>
                            <span class="admin-ch-type-badge">원격 추정</span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn danger" @click="removeEmojiMuteById(m.id)" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
            <div v-else class="admin-section">
                <p class="admin-label-hint">로그인 후 더 많은 설정을 이용할 수 있습니다.</p>
            </div>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()
const { theme, toggle: toggleTheme } = useTheme()

// 이메일 인증 상태 — required가 false면(서버가 SMTP를 아예 안 씀) 배지 자체를 안 띄움
const { data: emailVerificationData } = await useAsyncData(
    'email-verification-status',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getEmailVerificationStatus`, { method: 'POST', body: { userid: userId.value } })
        : Promise.resolve({ required: false, verified: true }),
    { watch: [userId] },
)
const emailVerificationRequired = computed(() => emailVerificationData.value?.required ?? false)
const emailVerified = computed(() => emailVerificationData.value?.verified ?? true)

const resendSaving = ref(false)
const resendError = ref('')
const resendSent = ref(false)
const resendCooldown = ref(false)
let resendCooldownTimer = null

async function resendVerification() {
    if (resendSaving.value || resendCooldown.value) return
    resendSaving.value = true
    resendError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/resendVerificationEmail`, {
            method: 'POST',
            body: { userid: userId.value },
        })
        resendSent.value = true
        resendCooldown.value = true
        if (resendCooldownTimer) clearTimeout(resendCooldownTimer)
        resendCooldownTimer = setTimeout(() => { resendCooldown.value = false }, 60_000)
    } catch (e) {
        resendError.value = e?.data?.message ?? '재전송에 실패했습니다'
    } finally {
        resendSaving.value = false
    }
}

const { data: pendingFollowsData, refresh: refreshPendingFollows } = await useAsyncData(
    'pending-follows',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getPendingFollows`, { method: 'POST', body: { userid: userId.value } })
        : Promise.resolve({ requireFollowApproval: false, pending: [] }),
    { watch: [userId] },
)
const requireFollowApproval = computed(() => pendingFollowsData.value?.requireFollowApproval ?? false)
const pendingFollows = computed(() => pendingFollowsData.value?.pending ?? [])

const approvalSettingSaving = ref(false)
async function toggleRequireApproval() {
    if (approvalSettingSaving.value) return
    approvalSettingSaving.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/updateProfile`, {
            method: 'POST',
            body: { userid: userId.value, requireFollowApproval: !requireFollowApproval.value },
        })
        await refreshPendingFollows()
    } finally {
        approvalSettingSaving.value = false
    }
}

async function respondFollow(followId, approve) {
    await $fetch(`${apiBaseUrl}/api/${approve ? 'approveFollow' : 'rejectFollow'}`, {
        method: 'POST',
        body: { userid: userId.value, followId },
    }).catch(() => {})
    await refreshPendingFollows()
}

const { data: remoteFollowsData, refresh: refreshRemoteFollows } = await useAsyncData(
    'remote-follows',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getRemoteFollows`, { method: 'POST', body: { userid: userId.value } }).then(res => Array.isArray(res) ? res : [])
        : Promise.resolve([]),
    { watch: [userId] },
)
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
    } catch (e) {
        remoteFollowError.value = e?.data?.message ?? '언팔로우에 실패했습니다'
    }
}

const { data: mutesData, refresh: refreshMutes } = await useAsyncData(
    'mutes-list',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getMutes`, { method: 'POST', body: { userid: userId.value } }).then(res => Array.isArray(res) ? res : [])
        : Promise.resolve([]),
    { watch: [userId] },
)
const mutesList = computed(() => mutesData.value ?? [])

async function unmute(m) {
    await $fetch(`${apiBaseUrl}/api/unmuteUser`, {
        method: 'POST',
        body: m.kind === 'remote'
            ? { userid: userId.value, targetActorUrl: m.targetActorUrl }
            : { userid: userId.value, targetUserId: m.targetUserId },
    }).catch(() => {})
    await refreshMutes()
}

const { data: wordMutesData, refresh: refreshWordMutes } = await useAsyncData(
    'word-mutes-list',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getWordMutes`, { method: 'POST', body: { userid: userId.value } }).then(res => Array.isArray(res) ? res : [])
        : Promise.resolve([]),
    { watch: [userId] },
)
const wordMutesList = computed(() => wordMutesData.value ?? [])

const newWordMutePattern = ref('')
const newWordMuteIsRegex = ref(false)
const newWordMuteLevel = ref('soft')
const wordMuteSaving = ref(false)
const wordMuteError = ref('')

async function submitWordMute() {
    if (!newWordMutePattern.value.trim() || wordMuteSaving.value) return
    wordMuteSaving.value = true
    wordMuteError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/addWordMute`, {
            method: 'POST',
            body: {
                userid: userId.value,
                pattern: newWordMutePattern.value.trim(),
                isRegex: newWordMuteIsRegex.value,
                level: newWordMuteLevel.value,
            },
        })
        newWordMutePattern.value = ''
        newWordMuteIsRegex.value = false
        newWordMuteLevel.value = 'soft'
        await refreshWordMutes()
    } catch (e) {
        wordMuteError.value = e?.data?.message ?? '단어 뮤트 추가에 실패했습니다'
    } finally {
        wordMuteSaving.value = false
    }
}

async function removeWordMute(id) {
    await $fetch(`${apiBaseUrl}/api/removeWordMute`, {
        method: 'POST',
        body: { userid: userId.value, id },
    }).catch(() => {})
    await refreshWordMutes()
}

// 커스텀 이모지 뮤트 — 이 서버 등록 이모지는 그리드에서 클릭으로, 그 외(다른/원격 서버 이모지)는
// 샷코드를 직접 입력해서 뮤트할 수 있음(뮤트는 서버 구분 없이 그냥 문자열 매칭이라 어느 쪽이든 동작함)
const { list: customEmojiList, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
onMounted(() => { ensureCustomEmojisLoaded() })

const { data: emojiMutesData, refresh: refreshEmojiMutes } = await useAsyncData(
    'emoji-mutes-list',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getEmojiMutes`, { method: 'POST', body: { userid: userId.value } }).then(res => Array.isArray(res) ? res : [])
        : Promise.resolve([]),
    { watch: [userId] },
)
const mutedShortcodes = computed(() => new Set((emojiMutesData.value ?? []).map((m) => m.shortcode)))
// 그리드(이 서버 등록 이모지)에 없는 뮤트 항목만 따로 — 직접 입력으로 추가한 원격 추정 이모지
const remoteMutedEmojis = computed(() => {
    const localShortcodes = new Set(customEmojiList.value.map((e) => e.shortcode))
    return (emojiMutesData.value ?? []).filter((m) => !localShortcodes.has(m.shortcode))
})
const emojiMuteError = ref('')
const newEmojiMuteShortcode = ref('')

async function toggleEmojiMute(shortcode) {
    emojiMuteError.value = ''
    try {
        if (mutedShortcodes.value.has(shortcode)) {
            const row = (emojiMutesData.value ?? []).find((m) => m.shortcode === shortcode)
            if (row) {
                await $fetch(`${apiBaseUrl}/api/removeEmojiMute`, {
                    method: 'POST',
                    body: { userid: userId.value, id: row.id },
                })
            }
        } else {
            await $fetch(`${apiBaseUrl}/api/addEmojiMute`, {
                method: 'POST',
                body: { userid: userId.value, shortcode },
            })
        }
        await refreshEmojiMutes()
    } catch (e) {
        emojiMuteError.value = e?.data?.message ?? '처리에 실패했습니다'
    }
}

async function submitEmojiMuteByShortcode() {
    const shortcode = newEmojiMuteShortcode.value.trim().replace(/^:|:$/g, '')
    if (!shortcode) return
    emojiMuteError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/addEmojiMute`, {
            method: 'POST',
            body: { userid: userId.value, shortcode },
        })
        newEmojiMuteShortcode.value = ''
        await refreshEmojiMutes()
    } catch (e) {
        emojiMuteError.value = e?.data?.message ?? '처리에 실패했습니다'
    }
}

async function removeEmojiMuteById(id) {
    await $fetch(`${apiBaseUrl}/api/removeEmojiMute`, {
        method: 'POST',
        body: { userid: userId.value, id },
    }).catch(() => {})
    await refreshEmojiMutes()
}
</script>

<style>
#preferences-content {
    padding: 20px 24px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.pref-theme-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.emoji-mute-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.emoji-mute-item {
    position: relative;
    width: 40px;
    height: 40px;
    padding: 6px;
    border-radius: 8px;
    border: 1px solid rgba(var(--fg-rgb),0.12);
    background: rgba(var(--fg-rgb),0.03);
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
}
.emoji-mute-item:hover { background: rgba(var(--fg-rgb),0.07); }
.emoji-mute-item.muted {
    border-color: rgba(255,84,84,0.5);
    background: rgba(255,84,84,0.08);
}

.emoji-mute-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 1;
    transition: opacity 0.1s;
}
.emoji-mute-item.muted .emoji-mute-img { opacity: 0.35; }

.emoji-mute-badge {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    color: #ff5454;
    pointer-events: none;
}

.pref-theme-label {
    font-size: 0.95rem;
    color: rgba(var(--fg-rgb),0.8);
}

.pref-theme-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(var(--fg-rgb),0.06);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 0.85rem;
    font-family: inherit;
    color: rgba(var(--fg-rgb),0.85);
    cursor: pointer;
    transition: background 0.1s;
}
.pref-theme-btn:hover { background: rgba(var(--fg-rgb),0.1); }
</style>
