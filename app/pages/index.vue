<script setup>
// 이 파일 하나가 /, /shop, /settings, /members, /info, /preferences, /timeline을 전부 담당함
// (definePageMeta의 alias). 전부 같은 "마을" 방(path='/')을 보여주고 그 위에 다른 창(page prop)만
// 여는 화면들인데, 예전엔 이 화면 하나하나가 각자 다른 페이지 파일(shop.vue/settings.vue/...)
// 이어서 Vue Router가 서로 다른 컴포넌트로 취급했음 — 그래서 상점 열고 닫을 때마다(실제로는
// 그냥 같은 방 위에 창 하나 여닫는 거여야 하는데) RoomMap.vue가 매번 통째로 새로 마운트되면서
// 캐릭터 위치가 스폰으로 리셋되고 웹소켓도 재접속되는 게 "다른 방으로 들어간" 것처럼 보였음.
// alias로 전부 같은 페이지 컴포넌트가 매핑되게 하면 Vue Router가 인스턴스를 재사용해서
// RoomMap.vue가 안 다시 마운트되고, page prop만 반응형으로 바뀌면서 창만 매끄럽게 바뀜.
definePageMeta({
    alias: ['/shop', '/settings', '/members', '/info', '/preferences', '/timeline'],
})

const PAGE_BY_PATH = {
    '/shop': 'shop',
    '/settings': 'settings',
    '/members': 'members',
    '/info': 'info',
    '/preferences': 'preferences',
    '/timeline': 'timeline',
}

const route = useRoute()
const page = computed(() => PAGE_BY_PATH[route.path] ?? 'none')

const { server, slug, accent, bgaccent, accentFgRgb } = await useServer()
const path = computed(() => '/')
</script>

<template>
    <div class="parent-wrapper">
        <ServerHeader :title="server?.title ?? ''" :slug="slug" :avatar="server?.avatar" />
        <ServerSidebar :id="server?.id ?? 0" :slug="slug" :rooms="server?.rooms ?? '[]'" :path="path" />
        <ServerProfilebar />
        <RoomMap :page="page" :id="server?.id ?? 0" :path="path" />
    </div>
</template>

<style scoped>
.parent-wrapper {
    --accent: v-bind(accent);
    --bgaccent: v-bind(bgaccent);
    --accent-fg-rgb: v-bind(accentFgRgb);
}
</style>
