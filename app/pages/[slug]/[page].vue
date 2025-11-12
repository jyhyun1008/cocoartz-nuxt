<script setup>
const config = useRuntimeConfig();
const apiBaseUrl = config.public.apiBaseUrl;
import ServerHeader from '~/components/ServerHeader.vue';
import ServerSidebar from '~/components/ServerSidebar.vue';

const slug = useRoute().params.slug
const page = useRoute().params.page
const path = `/${slug}/${page}`

const response = await fetch(`${apiBaseUrl}/api/getServerBySlug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug: slug
      }),
    })

const result = await response.json()

const serverInfo = result[0]

let pageInfo = {
        id: 0,
        path: `/${slug}/random`,
        knownAs: '랜덤',
        type: 'room'
    }

if (page == 'practiceroom') {
    pageInfo = {
        id: 3,
        path: `/${slug}/practiceroom`,
        knownAs: '합주실',
        type: 'room'
    }
} else if (page == 'gallery') {
    pageInfo = {
        id: 2,
        path: `/${slug}/gallery`,
        knownAs: '갤러리',
        type: 'board'
    }
}

const accent = serverInfo.themecolor?serverInfo.themecolor:'var(--accent)'
const bgaccent = serverInfo.themecolor?`${accent}22`:'var(--bgaccent)'

</script>

<template>
    <div class="parant-wrapper">
        <ServerHeader :title=serverInfo.title :slug=serverInfo.slug :avatar=serverInfo.avatar />
        <ServerSidebar :id="serverInfo.id" :slug=serverInfo.slug :rooms=serverInfo.rooms :path=path />
        <ServerProfilebar />
        <RoomMap :page=pageInfo.type :path=path />
    </div>
</template>

<style scoped>

.parant-wrapper {
    --accent: v-bind(accent);
    --bgaccent: v-bind(bgaccent);
}

</style>