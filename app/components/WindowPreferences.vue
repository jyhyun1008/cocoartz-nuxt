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

            <!-- 원격 계정 팔로우 -->
            <template v-if="isLoggedIn">
                <div class="admin-section">
                    <div class="admin-section-header">
                        <span class="admin-section-title">팔로우 중인 원격 계정</span>
                    </div>
                    <p class="admin-label-hint" style="margin:-4px 0 10px">
                        fediverse(마스토돈/미스키 등) 계정을 팔로우하면 <NuxtLink to="/timeline" style="color:var(--accent)">타임라인</NuxtLink>에 글이 모여요.
                    </p>
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
