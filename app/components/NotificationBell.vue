<template>
    <div id="notif-bell-wrapper">
        <button id="notif-bell-btn" class="shortcut" :title="t('notifications.title')" @click.stop="toggleOpen">
            <i class="hgi hgi-stroke hgi-notification-03"></i>
            <span v-if="unreadCount > 0" id="notif-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
        </button>

        <div v-if="isOpen" id="notif-backdrop" @click="isOpen = false"></div>
        <div v-if="isOpen" id="notif-dropdown">
            <div id="notif-dropdown-header">{{ t('notifications.title') }}</div>
            <div v-if="!notifications.length" class="notif-empty">{{ t('notifications.empty') }}</div>
            <NuxtLink
                v-for="n in notifications"
                :key="n.id"
                :to="n.actor?.username ? `/@${n.actor.username}` : '#'"
                class="notif-item"
                @click="isOpen = false"
            >
                <NuxtImg v-if="n.actor?.avatar" :src="n.actor.avatar" class="notif-avatar" />
                <div v-else class="notif-avatar notif-avatar-empty">{{ (n.actor?.knownas ?? n.actor?.username ?? '?')[0] }}</div>
                <div class="notif-text">
                    <strong>{{ n.actor?.knownas ?? n.actor?.username ?? t('notifications.unknownUser') }}</strong>{{ t('notifications.followedYouSuffix') }}
                </div>
            </NuxtLink>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()
const { t } = useI18n()

const notifications = ref([])
const unreadCount = ref(0)
const isOpen = ref(false)
let pollTimer = null

async function fetchNotifications() {
    if (!userId.value) return
    const res = await $fetch(`${apiBaseUrl}/api/getNotifications`, {
        method: 'POST',
        body: { userid: userId.value },
    })
    notifications.value = res.notifications ?? []
    unreadCount.value = res.unreadCount ?? 0
}

async function toggleOpen() {
    isOpen.value = !isOpen.value
    if (isOpen.value && unreadCount.value > 0) {
        await $fetch(`${apiBaseUrl}/api/markNotificationsRead`, {
            method: 'POST',
            body: { userid: userId.value },
        })
        unreadCount.value = 0
    }
}

onMounted(() => {
    fetchNotifications()
    pollTimer = setInterval(fetchNotifications, 30000)
})

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer)
})
</script>

<style>
#notif-bell-wrapper {
    position: relative;
}

#notif-bell-btn {
    position: relative;
    border: none;
    background: none;
    cursor: pointer;
}

#notif-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: white;
    color: var(--accent);
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 8px;
    min-width: 14px;
    text-align: center;
}

#notif-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9998;
}

#notif-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 320px;
    max-height: 420px;
    overflow-y: auto;
    background: var(--surface-1-blur);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(var(--fg-rgb),0.08);
    border-radius: 12px;
    box-shadow: var(--modal-shadow, 0 24px 64px rgba(0,0,0,0.35));
    z-index: 9999;
    color: rgba(var(--fg-rgb),1);
}

#notif-dropdown-header {
    padding: 12px 16px;
    font-weight: 700;
    font-size: 0.9rem;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.08);
}

.notif-empty {
    padding: 24px 16px;
    text-align: center;
    color: rgba(var(--fg-rgb),0.35);
    font-size: 0.85rem;
}

.notif-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    text-decoration: none;
    color: inherit;
    transition: background 0.1s;
}
.notif-item:hover { background: rgba(var(--fg-rgb),0.06); }

.notif-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background-color: var(--accent);
}

.notif-avatar-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--accent-fg-rgb),1);
    font-weight: 700;
    font-size: 0.85rem;
}

.notif-text {
    font-size: 0.85rem;
    color: rgba(var(--fg-rgb),0.8);
    line-height: 1.4;
}

.notif-text strong {
    color: rgba(var(--fg-rgb),1);
}
</style>
