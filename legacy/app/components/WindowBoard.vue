<template>
    <div id ="page-wrapper" class="large">
        <NuxtLink :to=slugpath><div id="enlarge"><i class="hgi hgi-stroke hgi-arrow-diagonal"></i></div></NuxtLink>
        <div id="board-wrapper">
            <h1>게시판</h1>
            <div class="board">
                <div v-for="post in postList" class="postlist">
                    <div class="posttitle">
                        <div>{{ post.title }}</div>
                        <div class="datetime" v-if="post.createdAt.split('T')[0]==today" >{{ post.createdAt.split('T')[1].slice(0,5) }}</div>
                    <div class="datetime" v-else>{{ post.createdAt.split('T')[0] }}</div>
                    </div>
                    <div class="knownas">{{ post.user.knownas }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>

const config = useRuntimeConfig();
const apiBaseUrl = config.public.apiBaseUrl;
const route = useRoute();
const fullpath = route.fullPath
const slug = route.params.slug
const slugpath = `/${slug}/`
const page = fullpath.split('/')[2]

const props = defineProps({
    ids: {
        type: Object,
        // 객체나 배열의 기본값은 반드시
        // 팩토리 함수에서 반환해야 합니다. 이 함수는
        // 컴포넌트가 받은 원시 props를 인자로 받습니다.
        default(rawProps) {
            return { 
                serverid: 0,
                roomid: 0,
            }
        }
    },
})

const postKey = computed(() => {
  const slug = route.params.slug;
  const page = route.params.page || 'default'; // page가 undefined일 경우
  return `post-data-${slug}-${page}`;
});

console.log(postKey)

const { data: postData } = await useAsyncData(
    postKey, async () => {
        const response = await $fetch(`${apiBaseUrl}/api/getPostsByRoomId`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(props.ids),
        })

        if (response && Array.isArray(response) && response.length > 0) {
            return response
        } else {
            return null; // 데이터가 없으면 null을 반환하여 roomData를 초기화
        }
    }, {
        watch: [
            () => route.params.slug,
            () => route.params.page
        ]
    }
)

const postList = postData.value
console.log(postData.value)

onMounted(() => {
    document.querySelector('#map').classList.add('blur')
})

</script>

<style>

#board-wrapper {
    padding: 20px;
    font-size: 18px;
}

#board-wrapper h1 {
    margin: 0;
    color: var(--accent);
}

#page-wrapper a {
    text-decoration: none;
    color: inherit;
}

#board-wrapper .postlist {
    display: flex;
    border-bottom: 1px solid #00000022;
    justify-content: space-between;
    padding: 5px 10px;
}

#board-wrapper .postlist:hover {
    background-color: var(--bgaccent);
}

.posttitle {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.postlist .knownas {
    font-weight: 700;
    line-height: 1.8;
}

</style>