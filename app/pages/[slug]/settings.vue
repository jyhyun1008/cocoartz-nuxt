<script setup>
import ServerHeader from '~/components/ServerHeader.vue';
import ServerSidebar from '~/components/ServerSidebar.vue';

const slug = useRoute().params.slug
const path = `/${slug}/`

const serverInfo = {
    id: 0,
    slug: slug,
    title: '연이나 놀이터',
    themeColor: '#FA4E79',
    avatar: "https://zfagftpyotjtopheclwh.supabase.co/storage/v1/object/public/avatars/profile/profile1_c0b3dce9b8e4c8da2bad7efb3c376a780ae61bffcbddf5ce6f0903a8133b93da.png",
    members: [{
        id: 0,
        username: 'howeverina',
        knownAs: '연이나'
    }],
}

const accent = serverInfo.themeColor?serverInfo.themeColor:'var(--accent)'
const bgaccent = serverInfo.themeColor?`${accent}22`:'var(--bgaccent)'

</script>

<template>
    <div class="parant-wrapper">
        <ServerHeader :title=serverInfo.title :slug=serverInfo.slug :avatar="serverInfo.avatar" />
        <ServerSidebar :id="serverInfo.id" :slug=serverInfo.slug :rooms=serverInfo.rooms :path=path />
        <ServerProfilebar />
        <RoomMap page="settings" :path=path />
    </div>
</template>

<style scoped>

.parant-wrapper {
    --accent: v-bind(accent);
    --bgaccent: v-bind(bgaccent);
}

</style>