<template>
    <div id="header-wrapper">
        <button id="mobile-nav-toggle" type="button" @click="toggleMobileNav" aria-label="메뉴 열기">
            <i class="hgi hgi-stroke hgi-menu-01"></i>
        </button>
        <div id="title-wrapper">
            <NuxtLink :to="fullPath" id="title-link">
                <NuxtImg v-if="props.avatar" id="serveravatar" :src="props.avatar" />
                <div v-else id="server-icon">{{ props.title[0] }}</div>
                <span>{{ props.title }}</span>
            </NuxtLink>
        </div>
        <div id="shortcut-wrapper">
            <NuxtLink :to="infoPath" class="shortcut" title="서버 정보">
                <i class="hgi hgi-stroke hgi-information-square"></i>
            </NuxtLink>
            <NuxtLink :to="membersPath" class="shortcut" title="멤버">
                <i class="hgi hgi-stroke hgi-user-group"></i>
            </NuxtLink>
            <NuxtLink :to="timelinePath" class="shortcut" title="연합 타임라인">
                <i class="hgi hgi-stroke hgi-globe-02"></i>
            </NuxtLink>
            <NuxtLink :to="settingsPath" class="shortcut" title="설정">
                <i class="hgi hgi-stroke hgi-setting-07"></i>
            </NuxtLink>
            <NotificationBell v-if="isLoggedIn" />
            <button class="shortcut theme-toggle-btn" type="button" @click="toggleTheme" title="테마 전환">
                <i class="hgi hgi-stroke" :class="theme === 'dark' ? 'hgi-sun-01' : 'hgi-moon-02'"></i>
            </button>
        </div>
        <div class="bycocoartz">
            <NuxtLink to="/">By COCOARTZ</NuxtLink>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
  title: { type: String, required: true },
  slug: { type: String, required: true },
  avatar: String,
})

const { toggle: toggleMobileNav } = useMobileNav()
const { isLoggedIn } = useCurrentUser()
const { theme, toggle: toggleTheme } = useTheme()

const fullPath = '/'
const infoPath = '/info'
const membersPath = '/members'
const timelinePath = '/timeline'
const settingsPath = '/settings'
</script>

<style>
#header-wrapper {
    padding: 0 16px;
    width: 100%;
    height: 3rem;
    display: flex;
    align-items: center;
    position: fixed;
    z-index: 9999;
    top: 0;
    left: 0;
    color: white;
    background-color: var(--accent);
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}

#header-wrapper a {
    text-decoration: none;
    color: inherit;
    display: flex;
    gap: 8px;
    align-items: center;
}

#serveravatar {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 6px;
    object-fit: cover;
}

#server-icon {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 6px;
    background: rgba(255,255,255,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
    flex-shrink: 0;
}

#title-wrapper {
    font-weight: 700;
    width: 284px;
    font-size: 1rem;
    overflow: hidden;
    flex-shrink: 0;
}

#title-link span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#shortcut-wrapper {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.shortcut {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 6px;
    color: rgba(255,255,255,0.8) !important;
    transition: background 0.15s, color 0.15s;
    font-size: 1.1rem;
}

.shortcut:hover {
    background: rgba(255,255,255,0.15);
    color: white !important;
}

.theme-toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
}

.bycocoartz {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.6);
    white-space: nowrap;
}

.bycocoartz a {
    color: inherit !important;
}

#mobile-nav-toggle {
    display: none;
    background: none;
    border: none;
    color: white;
    font-size: 1.3rem;
    padding: 6px;
    margin-right: 4px;
    cursor: pointer;
    flex-shrink: 0;
}

@media (max-width: 768px) {
    #mobile-nav-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    #title-wrapper {
        width: auto;
        max-width: 40%;
        flex-grow: 0;
        flex-shrink: 1;
        min-width: 0;
    }

    #shortcut-wrapper {
        flex-grow: 1;
        justify-content: flex-end;
    }

    .bycocoartz {
        display: none;
    }
}
</style>
