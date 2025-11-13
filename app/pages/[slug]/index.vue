<script setup>
import { computed } from 'vue';
const route = useRoute();

const slug = route.params.slug
const path = computed(() => {
    return `/${slug}/` 
});
const serverKey = computed(() => {
  return `server-data-${route.params.slug}`
});

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

const accent = serverInfo.themecolor?serverInfo.themecolor:'var(--accent)'
const mapbg = serverInfo.themecolor?`${accent}55`:'var(--mapbg)'
const bgaccent = serverInfo.themecolor?`${accent}22`:'var(--bgaccent)'

</script>

<template>
    <div class="parant-wrapper">
        <ServerHeader :title=serverInfo.title :slug=route.params.slug :avatar=serverInfo.avatar />
        <ServerSidebar :id=serverInfo.id :slug=route.params.slug :rooms=serverInfo.rooms :path=path />
        <ServerProfilebar />
        <RoomMap page="none" :id=serverInfo.id :path=path />
    </div>
</template>

<style scoped>

.parant-wrapper {
    --accent: v-bind(accent);
    /* --mapbg: v-bind(mapbg); */
    --bgaccent: v-bind(bgaccent);
}

</style>