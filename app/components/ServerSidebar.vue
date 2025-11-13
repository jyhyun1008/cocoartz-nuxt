<template>
    <div id="sidebar-wrapper">
        <div id="basic-wrapper">
            <div class="side-title">기본 채널</div>
            <NuxtLink :to=fullPath>
                <div class="side-items thispage" v-if="props.path==fullPath">
                    <i class="hgi hgi-stroke hgi-home-07"></i>
                    <span>마을</span>
                </div>
                <div class="side-items" v-else>
                    <i class="hgi hgi-stroke hgi-home-07"></i>
                    <span>마을</span>
                </div>
            </NuxtLink>
            <div class="side-items">
                <i class="hgi hgi-stroke hgi-notification-01"></i>
                <span>공지 게시판</span>
            </div>
        </div>
        <hr />
        <div id="pages-wrapper">
            <NuxtLink v-for="pageitem in rooms" :to=pageitem.path :key="pageitem.path">
                <div v-if="pageitem.type=='title'" class="side-title" >
                    <span>
                    {{ pageitem.knownas }}
                    </span>
                </div>
                <div v-else-if="props.path==pageitem.path" class="side-items thispage" >
                    <i v-if="pageitem.type=='board'" class="hgi hgi-stroke hgi-grid"></i>
                    <i v-else class="hgi hgi-stroke hgi-meeting-room"></i>
                    <span>
                    {{ pageitem.knownas }}
                    </span>
                </div>
                <div v-else class="side-items" >
                    <i v-if="pageitem.type=='board'" class="hgi hgi-stroke hgi-grid"></i>
                    <i v-else class="hgi hgi-stroke hgi-meeting-room"></i>
                    <span>
                    {{ pageitem.knownas }}
                    </span>
                </div>
            </NuxtLink>
        </div>
    </div>
</template>

<script setup>
const route = useRoute();
const config = useRuntimeConfig();
const apiBaseUrl = config.public.apiBaseUrl;

const props = defineProps({
  id: {
    type: Number,
    required: true
  },
  path: String,
  rooms: String,
});

let rooms = JSON.parse(props.rooms)

const { data: roomsData, error } = await useAsyncData(
    'rooms-data', async () => $fetch(`${apiBaseUrl}/api/getRoomsBySlug`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            slug: route.params.slug
        }),
    }))
    watch(roomsData, (newResults)=> {

        if (Array.isArray(newResults)) {
            for (let result of newResults) {
                let roomid = result.id
                let index = rooms.indexOf(roomid)
                rooms[index] = result
            }

        }
    }, { 
        immediate: true // 5. (선택사항) 페이지 로드 시에도 한 번 즉시 실행
    }
)

const fullPath = `/${route.params.slug}/`

</script>

<style>
#sidebar-wrapper {
    width: 220px;
    height: calc(100dvh - 3rem);
    background-color: #f3f5f7;
    position: fixed;
    top: 3rem;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
}

#sidebar-wrapper a {
    color: inherit;
    text-decoration: none;
}

.side-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--accent);
}

.side-items:hover, .side-items.thispage {
    background-color: var(--bgaccent);
    color: var(--accent);
}

hr {
    background-color: #00000022;
    height: 1px;
    width: 180px;
    border: 0;
}

#sidebar-wrapper i {
    color: #00000055;
}

.side-items {
    display: flex;
    gap: 5px;
    align-items: center;
    padding: 2px 10px;
    border-radius: 20px;
}

</style>