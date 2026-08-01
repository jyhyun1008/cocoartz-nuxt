<template>
    <div id="profile-bg">
        <div id="profile-wrapper">
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
                </div>
            </NuxtLink>
            <div id="settings-wrapper" @click="logout" title="로그아웃">
                <i class="hgi hgi-stroke hgi-logout-02"></i>
            </div>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const router = useRouter()
const { userId } = useCurrentUser()

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
    border-top: 1px solid rgba(255,255,255,0.05);
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
    color: white;
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
    color: rgba(255,255,255,0.9);
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.username {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#settings-wrapper {
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
}

#settings-wrapper:hover {
    color: rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.08);
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
#profile-left-link:hover { background: rgba(255,255,255,0.06); }
</style>
