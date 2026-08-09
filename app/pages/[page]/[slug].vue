<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

// ⚠️ computed로 둬야 함 — [page]/index.vue와 같은 이유(같은 페이지 컴포넌트로 매핑되는 라우트끼리는
// Vue Router가 인스턴스를 재사용해서 <script setup>이 다시 안 돎 — 그쪽 주석 참고)
const page = computed(() => route.params.page as string)
const wikiSlug = computed(() => (route.params.slug as string) ?? '')
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

// [page]/index.vue와 동일한 이유로 존재하지 않는 채널이면 404 처리
if (!roomData.value) {
    throw createError({ statusCode: 404, message: '페이지를 찾을 수 없습니다' })
}

const roomType = computed(() => roomData.value?.type ?? 'wiki')
</script>

<template>
    <div class="parent-wrapper">
        <ServerHeader :title="server?.title ?? ''" :slug="slug" :avatar="server?.avatar" />
        <ServerSidebar :id="server?.id ?? 0" :slug="slug" :rooms="server?.rooms ?? '[]'" :path="path" />
        <ServerProfilebar />
        <RoomMap :page="roomType" :id="server?.id ?? 0" :path="path" :wiki-slug="wikiSlug" />
    </div>
</template>

<style scoped>
.parent-wrapper {
    --accent: v-bind(accent);
    --bgaccent: v-bind(bgaccent);
    --accent-fg-rgb: v-bind(accentFgRgb);
}
</style>
