<script setup>
const { server, slug, accent, bgaccent, accentFgRgb } = await useServer()
const path = computed(() => '/noti')
</script>

<template>
    <div class="parent-wrapper">
        <ServerHeader :title="server?.title ?? ''" :slug="slug" :avatar="server?.avatar" />
        <ServerSidebar :id="server?.id ?? 0" :slug="slug" :rooms="server?.rooms ?? '[]'" :path="path" />
        <ServerProfilebar />
        <RoomMap page="board" :id="server?.id ?? 0" :path="path" />
    </div>
</template>

<style scoped>
.parent-wrapper {
    --accent: v-bind(accent);
    --bgaccent: v-bind(bgaccent);
    --accent-fg-rgb: v-bind(accentFgRgb);
}
</style>
