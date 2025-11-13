<script setup>
import { computed } from 'vue';
const route = useRoute();

const slug = route.params.slug
const page = route.params.page
const path = computed(() => {
    return `/${slug}/${page}` 
});
const serverKey = computed(() => {
  return `server-data-${route.params.slug}`
});

console.log(serverKey.value)

const config = useRuntimeConfig();
const apiBaseUrl = config.public.apiBaseUrl;
import ServerHeader from '~/components/ServerHeader.vue';
import ServerSidebar from '~/components/ServerSidebar.vue';

const { data: serverData, error } = await useAsyncData(
    serverKey.value, async () => {

        const response = await $fetch(`${apiBaseUrl}/api/getServerBySlug`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                slug: slug
            }),
        })

        return response[0]
    }, {
        watch: [() => route.params.slug ]
    }
)

const serverInfo = serverData.value

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
const mapbg = serverInfo.themecolor?`${accent}55`:'var(--mapbg)'
const bgaccent = serverInfo.themecolor?`${accent}22`:'var(--bgaccent)'

</script>

<template>
    <div class="parant-wrapper">
        <ServerHeader :title=serverInfo.title :slug=serverInfo.slug :avatar=serverInfo.avatar />
        <ServerSidebar :id="serverInfo.id" :slug=serverInfo.slug :rooms=serverInfo.rooms :path=path />
        <ServerProfilebar />
        <RoomMap :page=pageInfo.type :id=serverInfo.id :path=path />
    </div>
</template>

<style scoped>

.parant-wrapper {
    --accent: v-bind(accent);
    /* --mapbg: v-bind(mapbg); */
    --bgaccent: v-bind(bgaccent);
}

</style>