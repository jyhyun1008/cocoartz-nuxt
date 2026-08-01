<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

const page = route.params.page as string
const path = computed(() => `/${page}`)

const { server, slug, accent, bgaccent, accentFgRgb } = await useServer()

const { data: roomData } = await useAsyncData(
    `room-data-${page}`,
    () => $fetch<any[]>(`${apiBaseUrl}/api/getRoomByPath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/${page}` }),
    }).then(res => (Array.isArray(res) && res.length > 0 ? res[0] : null)),
    { watch: [() => route.params.page] }
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
