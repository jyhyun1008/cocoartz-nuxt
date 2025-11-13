<template>
    <div id="map-wrapper">
        <div id="map">
            <NuxtImg v-if="mapType == 'string'" class="maptempimg" :src=mapInfo />
            <div v-else></div>
        </div>
        <CharacterMoving :character=character />
        <div v-if="props.page == 'none' || props.page == 'room'" id="chatroom-wrapper" class="little">
            <div id="enlarge"><i class="hgi hgi-stroke hgi-arrow-diagonal"></i></div>
            <div id="chats-wrapper">
                <div v-for="chat in chats" :key=chat.id class="chat-wrapper">
                    <div class="userprofile">
                        <NuxtImg class="avatar" :src=chat.user.avatar />
                    </div>
                    <div class="userchatbox">
                        <div class="userinfo">
                            <span class="knownas">{{ chat.user.knownas }}</span>
                            <span class="datetime" v-if="chat.createdAt.split('T')[0]==today" >{{ chat.createdAt.split('T')[1].slice(0,5) }}</span>
                            <span class="datetime" v-else>{{ chat.createdAt.split('T')[0] }}</span>
                        </div>
                        <div class="msg">{{ chat.content }}</div>
                    </div>
                </div>
            </div>
            <div id="chatsender-wrapper">
                <input placeholder="메시지 보내기"></input>
                <div id="sendchat">전송</div>
            </div>
        </div>
        <WindowInfo v-if="props.page == 'info'" />
    </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
const route = useRoute();
import WindowInfo from './WindowInfo.vue';
const config = useRuntimeConfig();
const apiBaseUrl = config.public.apiBaseUrl;

function isJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

const roomKey = computed(() => {
  const slug = route.params.slug;
  const page = route.params.page || 'default'; // page가 undefined일 경우
  return `room-data-${slug}-${page}`;
});

const chatKey = computed(() => {
  const slug = route.params.slug;
  const page = route.params.page || 'default'; // page가 undefined일 경우
  return `chat-data-${slug}-${page}`;
});

const character = "/defcharacter.png"
const props = defineProps({
    id: {
        type: Number,
        required: true
    },
    page: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    }
});
const slug = route.params.slug
let now = new Date()
let today = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`

let mapType = "object"
let mapInfo

const { data: roomData, error } = await useAsyncData(
    roomKey, async () => {
        const apiPath = `/${route.params.slug}/${route.params.page ? route.params.page : ''}`
        const response = await $fetch(`${apiBaseUrl}/api/getRoomsByPath`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                path: apiPath
            }),
        })
        if (response && Array.isArray(response) && response.length > 0) {
            return response[0]; // 데이터가 있으면 첫 번째 항목 반환
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


const { data: chatData } = await useAsyncData(
    chatKey, async () => {
        const response = await $fetch(`${apiBaseUrl}/api/getChatsByRoomId`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                serverid: props.id,
                roomid: route.params.page?roomData.value.id:0
            }),
        })
        if (response && Array.isArray(response) && response.length > 0) {
            console.log(response)
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

console.log(chatData.value)
mapInfo = roomData.value.map


if (isJSON(mapInfo) == false) {
    mapType = 'string'
}

const chats = chatData.value

onMounted(() => {

    var positionStorage

    if (localStorage.getItem('position')) {
        if (JSON.parse(localStorage.getItem('position')).roomPath !== props.path) {
            positionStorage = {
                roomPath: props.path,
                x: 0,
                y: 0
            }
            localStorage.setItem('position', JSON.stringify(positionStorage))
        } else {

            positionStorage = JSON.parse(localStorage.getItem('position'))
        }
    } else {
        positionStorage = {
            roomPath: props.path,
            x: 0,
            y: 0
        }
        localStorage.setItem('position', JSON.stringify(positionStorage))
    }

    var position = positionStorage
    document.querySelector('#map').setAttribute("style", `left:${position.x*(-32)}px; top: ${position.y*(32)}px;`)

    document.querySelector('#enlarge')?.addEventListener('click', (e)=>{
        if (document.querySelector('#page-wrapper')) {
        } else {
            if (document.querySelector('#chatroom-wrapper').classList.contains('little')) {
                document.querySelector('#chatroom-wrapper').classList.add('large')
                document.querySelector('#chatroom-wrapper').classList.remove('little')
                document.querySelector('#map').classList.add('blur')
            } else {
                document.querySelector('#chatroom-wrapper').classList.add('little')
                document.querySelector('#chatroom-wrapper').classList.remove('large')
                document.querySelector('#map').classList.remove('blur')
            }
        }
    })

    window.addEventListener('keydown', (e)=>{
        if (e.code == 'KeyS') {
            position.y -= 0.25
            document.querySelector('#map').setAttribute('style', `left:${position.x*(-32)}px; top: ${position.y*(32)}px;`)
            localStorage.setItem('position', JSON.stringify(position))
        } else if (e.code == 'KeyW') {
            position.y += 0.25
            document.querySelector('#map').setAttribute('style', `left:${position.x*(-32)}px; top: ${position.y*(32)}px;`)
            localStorage.setItem('position', JSON.stringify(position))
        } else if (e.code == 'KeyA') {
            position.x -= 0.25
            document.querySelector('#map').setAttribute('style', `left:${position.x*(-32)}px; top: ${position.y*(32)}px;`)
            localStorage.setItem('position', JSON.stringify(position))
        } else if (e.code == 'KeyD') {
            position.x += 0.25
            document.querySelector('#map').setAttribute('style', `left:${position.x*(-32)}px; top: ${position.y*(32)}px;`)
            localStorage.setItem('position', JSON.stringify(position))
        } 
    })
});

</script>

<style>
#map-wrapper {
    width: calc(100vw - 220px);
    height: calc(100dvh - 3rem);
    position: fixed;
    bottom: 0;
    right: 0;
    overflow: hidden;
    background-color: var(--mapbg);
}

#map {
    width: 100%;
    height: 100%;
    position: relative;
    top: 0;
    left: 0;
}

#map.blur {
    filter: blur(1rem);
}

.maptempimg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
}

#chatroom-wrapper.little {
    width: calc(100% - 260px);
    max-width: 600px;
    height: 200px;
    position: relative;
    z-index: 99;
    bottom: 210px;
    left: 10px;
    background-color: #00000055;
    color: white;
    display: flex;
    flex-direction: column;
}

.large {
    width: calc(100% - 260px);
    max-width: 800px;
    height: 200px;
    position: relative;
    top: -80dvh;
    height: calc(60dvh + 3rem);
    margin: 0 auto;
    z-index: 99;
    background-color: #ffffffee;
    color: black;
    display: flex;
    flex-direction: column;
    border-radius: 20px;
    overflow: hidden;
}

#chats-wrapper {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex-grow: 1;
    overflow-y: scroll;
}

.chat-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 20px;
}

.userchatbox .userinfo {
    margin-bottom: 5px;
}

.userinfo {
    display: flex;
    gap: 20px;
    align-items: center;
}

.datetime {
    font-size: 0.8rem;
    color: lightgray;
}

.avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
}

#chatsender-wrapper {
    height: 2rem;
    display: flex;
    border-top: 1px solid white;
}

#chatsender-wrapper input {
    background-color: transparent;
    border: 0;
    color: inherit;
    flex-grow: 1;
    font-size: 1rem;
}

input:focus {
    outline: none;
}

#sendchat {
    width: 50px;
    text-align: center;
    background-color: var(--bgaccent);
}

.little #enlarge {
    width: 1.8rem;
    position: absolute;
    top: 0;
    right:0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.large #enlarge {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

#enlarge {
    background-color: var(--accent);
}

#enlarge i {
    color: white;
}

</style>