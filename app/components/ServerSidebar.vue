<template>
    <div v-if="isOpen" id="mobile-nav-backdrop" @click="close"></div>
    <div id="sidebar-wrapper" :class="{ open: isOpen }">
        <div id="basic-wrapper">
            <div class="side-title">기본</div>
            <NuxtLink :to="fullPath">
                <div class="side-items" :class="{ thispage: props.path === fullPath }">
                    <i class="hgi hgi-stroke hgi-home-07 side-icon"></i>
                    <span>마을</span>
                </div>
                <div v-if="roomPresence(fullPath).length" class="side-presence">
                    <div v-for="u in roomPresence(fullPath)" :key="u.userId" class="presence-user">
                        <NuxtImg v-if="u.user?.avatar" :src="u.user.avatar" class="presence-avatar" />
                        <div v-else class="presence-avatar presence-avatar-empty">{{ (u.user?.knownas ?? u.user?.username ?? '?')[0] }}</div>
                        <span class="presence-name">{{ u.user?.knownas ?? u.user?.username ?? '?' }}</span>
                    </div>
                </div>
            </NuxtLink>
            <NuxtLink :to="notiPath">
                <div class="side-items" :class="{ thispage: props.path === notiPath }">
                    <i class="hgi hgi-stroke hgi-notification-01 side-icon"></i>
                    <span>공지 게시판</span>
                </div>
                <div v-if="roomPresence(notiPath).length" class="side-presence">
                    <div v-for="u in roomPresence(notiPath)" :key="u.userId" class="presence-user">
                        <NuxtImg v-if="u.user?.avatar" :src="u.user.avatar" class="presence-avatar" />
                        <div v-else class="presence-avatar presence-avatar-empty">{{ (u.user?.knownas ?? u.user?.username ?? '?')[0] }}</div>
                        <span class="presence-name">{{ u.user?.knownas ?? u.user?.username ?? '?' }}</span>
                    </div>
                </div>
            </NuxtLink>
        </div>
        <div class="side-divider"></div>
        <div id="pages-wrapper">
            <template v-for="pageitem in resolvedRooms" :key="pageitem.path ?? pageitem.id">
                <div v-if="pageitem.type === 'title'" class="side-title">
                    {{ pageitem.knownas }}
                </div>
                <NuxtLink v-else :to="pageitem.path">
                    <div class="side-items" :class="{ thispage: props.path === pageitem.path }">
                        <i v-if="pageitem.type === 'board'" class="hgi hgi-stroke hgi-grid side-icon"></i>
                        <i v-else-if="pageitem.type === 'voice'" class="hgi hgi-stroke hgi-volume-high side-icon"></i>
                        <i v-else-if="pageitem.type === 'wiki'" class="hgi hgi-stroke hgi-book-open-01 side-icon"></i>
                        <i v-else class="hgi hgi-stroke hgi-meeting-room side-icon"></i>
                        <span>{{ pageitem.knownas }}</span>
                    </div>
                    <!-- 채널 내 접속 유저 (디스코드 음성채널 스타일) -->
                    <div v-if="roomPresence(pageitem.path).length" class="side-presence">
                        <div
                            v-for="u in roomPresence(pageitem.path)"
                            :key="u.userId"
                            class="presence-user"
                        >
                            <NuxtImg v-if="u.user?.avatar" :src="u.user.avatar" class="presence-avatar" />
                            <div v-else class="presence-avatar presence-avatar-empty">{{ (u.user?.knownas ?? u.user?.username ?? '?')[0] }}</div>
                            <span class="presence-name">{{ u.user?.knownas ?? u.user?.username ?? '?' }}</span>
                        </div>
                    </div>
                </NuxtLink>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

const props = defineProps({
  id: { type: Number, required: true },
  path: String,
  rooms: String,
})

const { presenceByRoom } = useRoomSocket()
const { isOpen, close } = useMobileNav()

function roomPresence(roomPath: string) {
  return presenceByRoom.value[roomPath] ?? []
}

const slug = config.public.serverSlug

// useServer()가 이미 'server-data' 키로 캐시해둔 데이터를 읽기만 함
// (다른 핸들러로 재등록하면 키 충돌 → 흰 화면 오류)
const { data: serverData } = useNuxtData('server-data')

const { data: roomsData } = await useAsyncData(
    'rooms-data',
    () => $fetch(`${apiBaseUrl}/api/getRoomsBySlug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
    }),
)

const resolvedRooms = computed(() => {
    const rawOrder: any[] = serverData.value?.rooms ? JSON.parse(serverData.value.rooms) : []
    const fetched = (roomsData.value as any[]) ?? []
    return rawOrder.map((entry: any) => {
        if (typeof entry === 'number') {
            return fetched.find(r => r.id === entry) ?? { id: entry, knownas: '?', type: 'room', path: '#' }
        }
        return entry
    })
})

const fullPath = '/'
const notiPath = '/noti'
</script>

<style>
#sidebar-wrapper {
    width: 300px;
    height: calc(100dvh - 3rem);
    background-color: var(--sidebar-bg);
    position: fixed;
    top: 3rem;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 8px;
    overflow-y: auto;
}

#sidebar-wrapper a {
    color: inherit;
    text-decoration: none;
}

.side-title {
    font-size: 0.68rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.35);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 14px 10px 4px;
}

.side-divider {
    height: 1px;
    background: rgba(var(--fg-rgb),0.06);
    margin: 4px 8px;
}

.side-items {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 5px 10px;
    border-radius: 6px;
    color: var(--sidebar-text);
    font-size: 0.95rem;
    transition: background 0.1s, color 0.1s;
}

.side-items:hover {
    background-color: rgba(var(--fg-rgb),0.07);
    color: var(--sidebar-text-hover);
}

.side-items.thispage {
    background-color: rgba(210,31,60,0.28);
    color: #ff8096;
}

.side-items.thispage .side-icon {
    color: var(--accent);
}

/* 채널 접속 유저 presence */
.side-presence {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 10px 4px 32px;
}

.presence-user {
    display: flex;
    align-items: center;
    gap: 6px;
}

.presence-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
}

.presence-avatar-empty {
    background-color: var(--bgaccent);
    border: 1px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.6rem;
}

.presence-name {
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.45);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.side-icon {
    color: rgba(var(--fg-rgb),0.3);
    font-size: 1rem;
    flex-shrink: 0;
    transition: color 0.1s;
}

.side-items:hover .side-icon {
    color: rgba(var(--fg-rgb),0.7);
}

#mobile-nav-backdrop {
    display: none;
}

@media (max-width: 768px) {
    #sidebar-wrapper {
        z-index: 9998;
        transform: translateX(-100%);
        transition: transform 0.2s ease;
        box-shadow: 4px 0 16px rgba(0,0,0,0.35);
    }

    #sidebar-wrapper.open {
        transform: translateX(0);
    }

    #mobile-nav-backdrop {
        display: block;
        position: fixed;
        inset: 3rem 0 0 0;
        background: rgba(0,0,0,0.5);
        z-index: 9997;
    }
}
</style>
