<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

// ⚠️ computed로 둬야 함 — 같은 페이지 컴포넌트로 매핑되는 라우트끼리(예: /free → /notice)는
// Vue Router가 컴포넌트 인스턴스를 재사용하고 <script setup>을 다시 안 돌림. 예전엔 이걸 그냥
// const로 route.params.page를 한 번만 읽어서, 사이드바에서 다른 채널로 넘어가도(주소창은
// 바뀌지만) path/roomData가 계속 처음 들어왔을 때의 채널로 고정돼있는 버그가 있었음
// (@[username].vue에도 완전히 같은 버그가 있어서 같이 고침).
const page = computed(() => route.params.page as string)
const path = computed(() => `/${page.value}`)

const { server, slug, accent, bgaccent, accentFgRgb } = await useServer()

// 고정 문자열 키 대신 키 자체에 page를 물림 — @[username].vue와 같은 이유(그쪽 주석 참고)
const { data: roomData } = await useAsyncData(
    () => `room-data-${page.value}`,
    () => $fetch<any[]>(`${apiBaseUrl}/api/getRoomByPath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.value }),
    }).then(res => (Array.isArray(res) && res.length > 0 ? res[0] : null)),
)

const roomType = computed(() => roomData.value?.type ?? 'room')
</script>

<template>
    <div class="parent-wrapper">
        <ServerHeader :title="server?.title ?? ''" :slug="slug" :avatar="server?.avatar" />
        <ServerSidebar :id="server?.id ?? 0" :slug="slug" :rooms="server?.rooms ?? '[]'" :path="path" />
        <ServerProfilebar />
        <RoomMap :page="roomType" :id="server?.id ?? 0" :path="path" />
    </div>
</template>

<style scoped>
.parent-wrapper {
    --accent: v-bind(accent);
    --bgaccent: v-bind(bgaccent);
    --accent-fg-rgb: v-bind(accentFgRgb);
}
</style>
