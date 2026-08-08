<template>
    <div id="profile-bg" :class="{ open: isOpen }">
        <!-- 로그인 상태 -->
        <div v-if="isLoggedIn" id="profile-wrapper">
            <NuxtLink :to="i?.username ? `/@${i.username}` : '#'" id="profile-left-link">
                <div id="avatar-wrapper">
                    <NuxtImg v-if="i?.avatar" :src="i.avatar" />
                    <div v-else class="avatar-placeholder">
                        {{ (i?.knownas ?? i?.username ?? '?')[0] }}
                    </div>
                    <div class="status-dot"></div>
                </div>
                <div id="text-wrapper">
                    <div class="knownas">{{ i?.knownas ?? i?.username ?? '...' }}</div>
                    <div class="username">@{{ i?.username ?? '' }}</div>
                    <div class="balance"><i class="hgi hgi-stroke hgi-coins-01"></i> {{ balanceData?.balance ?? 0 }} {{ server?.currencyName ?? '코코아' }}</div>
                </div>
            </NuxtLink>
            <NuxtLink to="/shop" id="shop-wrapper" title="상점">
                <i class="hgi hgi-stroke hgi-shopping-bag-01"></i>
            </NuxtLink>
            <NuxtLink to="/preferences" id="preferences-wrapper" title="내 설정">
                <i class="hgi hgi-stroke hgi-user-settings-01"></i>
            </NuxtLink>
            <div id="settings-wrapper" @click="logout" title="로그아웃">
                <i class="hgi hgi-stroke hgi-logout-02"></i>
            </div>
        </div>

        <!-- 비로그인 상태 -->
        <NuxtLink v-else to="/login" id="profile-wrapper" class="guest">
            <div id="profile-left-link">
                <div id="avatar-wrapper">
                    <div class="avatar-placeholder guest-avatar">
                        <i class="hgi hgi-stroke hgi-user"></i>
                    </div>
                </div>
                <div id="text-wrapper">
                    <div class="knownas">로그인하지 않음</div>
                    <div class="username">눌러서 로그인 / 가입</div>
                </div>
            </div>
            <div id="settings-wrapper" title="로그인">
                <i class="hgi hgi-stroke hgi-login-02"></i>
            </div>
        </NuxtLink>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const router = useRouter()
const { userId, isLoggedIn } = useCurrentUser()
const { isOpen } = useMobileNav()
const { server } = await useServer()

const { data: iData } = await useAsyncData(
    'i-data',
    () => userId.value
        ? $fetch(`${apiBaseUrl}/api/getUserById`, {
            method: 'POST',
            body: { userid: userId.value },
        })
        : null,
    { watch: [userId] }
)

const i = iData

// 재화 잔액 — RoomMap.vue와 같은 키('balance-data-{serverid}')로 useAsyncData를 불러서
// 데이터를 공유함(RoomMap.vue에서 코인을 모으면 여기 표시도 같이 갱신됨)
const { data: balanceData } = await useAsyncData(
    `balance-data-${server?.id}`,
    () => (isLoggedIn.value && server?.id)
        ? $fetch(`${apiBaseUrl}/api/getMyBalance`, {
            method: 'POST',
            body: { userid: userId.value, serverid: server.id },
        }).catch(() => ({ balance: 0 }))
        : { balance: 0 },
    { watch: [userId] }
)

async function logout() {
    await $fetch(`${apiBaseUrl}/api/auth/logout`, { method: 'POST' })
    userId.value = null
    await router.push('/login')
}
</script>

<style>
#profile-bg {
    background-color: var(--sidebar-bg2);
    width: 300px;
    position: fixed;
    bottom: 0;
    left: 0;
    border-top: 1px solid rgba(var(--fg-rgb),0.05);
}

#profile-wrapper {
    width: 300px;
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    align-items: center;
}

#avatar-wrapper {
    position: relative;
    flex-shrink: 0;
}

#avatar-wrapper img,
.avatar-placeholder {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 50%;
    background-color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--accent-fg-rgb),1);
    font-weight: 700;
    font-size: 1rem;
}

.status-dot {
    width: 12px;
    height: 12px;
    background-color: #23a559;
    border-radius: 50%;
    border: 2px solid var(--sidebar-bg2);
    position: absolute;
    bottom: 0;
    right: 0;
}

#text-wrapper {
    flex-grow: 1;
    overflow: hidden;
    line-height: 1.3;
}

#profile-bg .knownas {
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.9);
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.username {
    font-size: 0.75rem;
    color: rgba(var(--fg-rgb),0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.balance {
    font-size: 0.72rem;
    color: #d99a00;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 3px;
}

#settings-wrapper,
#preferences-wrapper,
#shop-wrapper {
    color: rgba(var(--fg-rgb),0.4);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
    display: flex;
}

#settings-wrapper:hover,
#preferences-wrapper:hover,
#shop-wrapper:hover {
    color: rgba(var(--fg-rgb),0.9);
    background: rgba(var(--fg-rgb),0.08);
}

#profile-left-link {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-grow: 1;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    border-radius: 6px;
    padding: 2px 4px;
    margin: -2px -4px;
    transition: background 0.1s;
}
#profile-left-link:hover { background: rgba(var(--fg-rgb),0.06); }

/* 비로그인 상태 */
#profile-wrapper.guest {
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    transition: background 0.1s;
}
#profile-wrapper.guest:hover { background: rgba(var(--fg-rgb),0.05); }

.guest-avatar {
    background-color: rgba(var(--fg-rgb),0.08);
    color: rgba(var(--fg-rgb),0.4);
    font-size: 1.1rem;
}

.guest .knownas { color: rgba(var(--fg-rgb),0.55); }
.guest .username { color: rgba(var(--fg-rgb),0.3); }

@media (max-width: 768px) {
    #profile-bg {
        z-index: 9998;
        transform: translateX(-100%);
        transition: transform 0.2s ease;
        box-shadow: 4px 0 16px rgba(0,0,0,0.35);
    }

    #profile-bg.open {
        transform: translateX(0);
    }
}
</style>
