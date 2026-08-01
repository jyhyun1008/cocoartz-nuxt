<template>
    <div id="map-wrapper">
        <!-- z=0 타일 레이어 -->
        <div id="map" :style="mapStyle" :class="{ blur: mapBlurred }">
            <NuxtImg v-if="mapType === 'string'" class="maptempimg" :src="mapInfo" />
            <div v-else-if="mapInfo && mapInfo[0]" class="maptiles1" :style="tilesScaleStyle">
                <div
                    v-for="tile in tilesBack"
                    :key="`${tile.position.x}-${tile.position.y}-${tile.position.z ?? 0}`"
                    class="tile-container"
                    :style="getTileContainerStyle(tile)"
                >
                    <div class="tile-slice" :style="tileTopSliceStyle">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileTopImgStyle" />
                    </div>
                    <div class="tile-slice" :style="tileSideTopStyle">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideTopImgStyle" />
                    </div>
                    <div class="tile-slice" :style="tileSideMiddleContainerStyle(tile)">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideMiddleImgStyle(tile)" />
                    </div>
                    <div class="tile-slice" :style="tileSideBottomStyle">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideBottomImgStyle" />
                    </div>
                </div>
            </div>
        </div>

        <!-- z≥1 레이어: 타일 + 캐릭터 + 다른 유저 → 각자 z-index로 깊이 결정 -->
        <div id="map-front" :class="{ blur: mapBlurred }">
            <div class="maptiles-pan" :style="mapStyle">
                <div class="maptiles1" :style="tilesScaleStyle">
                    <!-- z≥1 타일 (정렬 불필요, z-index가 깊이 담당) -->
                    <div
                        v-for="tile in tilesFront"
                        :key="`${tile.position.x}-${tile.position.y}-${tile.position.z ?? 0}`"
                        class="tile-container"
                        :style="getTileContainerStyle(tile)"
                    >
                        <div class="tile-slice" :style="tileTopSliceStyle">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileTopImgStyle" />
                        </div>
                        <div class="tile-slice" :style="tileSideTopStyle">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideTopImgStyle" />
                        </div>
                        <div class="tile-slice" :style="tileSideMiddleContainerStyle(tile)">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideMiddleImgStyle(tile)" />
                        </div>
                        <div class="tile-slice" :style="tileSideBottomStyle">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideBottomImgStyle" />
                        </div>
                    </div>
                    <!-- 로컬 캐릭터 -->
                    <CharacterMoving
                        :layers="localCharLayers"
                        :top-ratio="topRatio"
                        :zoom-level="zoomLevel"
                        :tile-mode="true"
                        :local-x="localPosition.x"
                        :local-y="localPosition.y"
                        :z-index="charZIndex"
                        :user-id="userId"
                    />
                    <!-- 다른 유저 -->
                    <OtherCharacter
                        v-for="other in otherUsersInRoom"
                        :key="other.userId"
                        :layers="getCharacterLayers(other.user?.character)"
                        :top-ratio="topRatio"
                        :local-x="other.x"
                        :local-y="other.y"
                        :z-index="Math.floor((other.y + 1) * -10) + 9999"
                        :direction="other.dir"
                        :name="other.user?.knownas ?? other.user?.username ?? '?'"
                        :user-id="other.userId"
                    />
                </div>
            </div>
        </div>

        <!-- 채팅 패널: room / none 모드 -->
        <div
            v-if="(props.page === 'none' || props.page === 'room') && showChatPanel"
            id="chatroom-wrapper"
            :class="chatSize"
        >
            <div class="window-header">
                <i class="hgi hgi-stroke hgi-meeting-room"></i>
                <span style="flex:1">{{ roomData?.knownas ?? '채팅' }}</span>
                <button class="chat-size-btn" @click.stop="toggleChatSize">
                    <i class="hgi hgi-stroke hgi-arrow-diagonal"
                       :style="chatSize === 'large' ? 'transform:rotate(180deg)' : ''"></i>
                </button>
                <button class="window-close-btn" @click.stop="closeChatPanel">✕</button>
            </div>
            <div id="chats-wrapper" ref="chatsWrapper">
                <div v-for="chat in chats" :key="chat.id" class="chat-wrapper">
                    <NuxtLink :to="chat.user?.username ? `/@${chat.user.username}` : '#'" class="userprofile user-avatar-link">
                        <NuxtImg v-if="chat.user?.avatar" class="avatar" :src="chat.user.avatar" />
                        <div v-else class="avatar avatar-placeholder">{{ (chat.user?.knownas ?? chat.user?.username ?? '?')[0] }}</div>
                    </NuxtLink>
                    <div class="userchatbox">
                        <div class="userinfo">
                            <NuxtLink :to="chat.user?.username ? `/@${chat.user.username}` : '#'" class="knownas user-name-link">
                                {{ chat.user?.knownas ?? chat.user?.username }}
                            </NuxtLink>
                            <span class="datetime" v-if="chat.createdAt.split('T')[0] === today">
                                {{ chat.createdAt.split('T')[1].slice(0, 5) }}
                            </span>
                            <span class="datetime" v-else>{{ chat.createdAt.split('T')[0] }}</span>
                        </div>
                        <div class="msg" v-html="renderMd(chat.content)"></div>
                    </div>
                </div>
            </div>
            <div id="chatsender-wrapper">
                <textarea
                    v-model="chatInput"
                    ref="chatInputEl"
                    placeholder="메시지 보내기"
                    rows="1"
                    class="chat-textarea"
                    @keydown.enter="handleChatEnter"
                ></textarea>
                <div id="sendchat" @click="sendChat">전송</div>
            </div>
        </div>
        <div v-if="(props.page === 'none' || props.page === 'room') && !showChatPanel"
             class="reopen-btn" @click="showChatPanel = true">
            <i class="hgi hgi-stroke hgi-meeting-room"></i> 채팅 열기
        </div>

        <WindowInfo v-else-if="props.page === 'info' && showOverlay" @close="closeOverlay" />
        <div v-if="props.page === 'info' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-information-square"></i> 서버 정보 열기
        </div>

        <WindowMembers v-if="props.page === 'members' && showOverlay" @close="closeOverlay" />
        <div v-if="props.page === 'members' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-user-group"></i> 멤버 열기
        </div>

        <WindowSettings v-if="props.page === 'settings' && showOverlay" @close="closeOverlay" />
        <div v-if="props.page === 'settings' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-setting-07"></i> 설정 열기
        </div>

        <WindowBoard v-if="props.page === 'board' && showOverlay" :ids="serverAndRoomId" :is-federated="!!roomData?.federated" @close="closeOverlay" />
        <div v-if="props.page === 'board' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-grid"></i> 게시판 열기
        </div>

        <WindowVoice
            v-if="props.page === 'voice' && showOverlay"
            :ids="serverAndRoomId"
            @close="closeVoiceOverlay"
            @set-blur="setBlurFromVoice"
        />
        <div
            v-if="props.page === 'voice' && !showOverlay"
            class="reopen-btn"
            @click="openVoiceOverlay"
        >
            <i class="hgi hgi-stroke hgi-volume-high"></i>
            음성채팅방 열기
        </div>

        <WindowWiki
            v-if="props.page === 'wiki' && showOverlay"
            :ids="serverAndRoomId"
            :channel-path="props.path"
            :target-slug="props.wikiSlug"
            @close="closeOverlay"
        />
        <div v-if="props.page === 'wiki' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-book-open-01"></i> 위키 열기
        </div>

        <WindowTimeline v-if="props.page === 'timeline' && showOverlay" @close="closeOverlay" />
        <div v-if="props.page === 'timeline' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-globe-02"></i> 연합 타임라인 열기
        </div>

        <!-- 모바일 전용 이동 조이스틱 (상/하/좌/우 4방향 스냅) -->
        <div v-show="!controlsBlocked" id="mobile-joystick" ref="joystickBase">
            <div id="joystick-knob" :style="joystickKnobStyle"></div>
        </div>
    </div>
</template>

<script setup>
import { marked } from 'marked'
const route = useRoute()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

const { userData: currentUserData, ensureLoaded: ensureUserLoaded } = useCurrentUserData()
const localCharLayers = computed(() => getCharacterLayers(currentUserData.value?.character))

function renderMd(text) {
    return String(marked.parse(text ?? '', { breaks: true }))
}

const props = defineProps({
    id: { type: Number, required: true },
    page: { type: String, required: true },
    wikiSlug: { type: String, default: '' },
    path: { type: String, required: true },
})

const { connect, joinRoom, sendPosition, sendChat: wsSendChat, otherUsersInRoom, realtimeChats } = useRoomSocket()

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

// 캐시 키는 route.params.page가 아니라 실제 방 경로(props.path) 기준이어야 함.
// noti.vue처럼 [page]/index.vue 라우트를 안 쓰는 정적 페이지들(index/settings/members/info/noti)은
// route.params.page가 전부 undefined라서 route.params.page 기준 키를 쓰면 서로 다른 방인데도
// 같은 캐시 키('room-data-index')로 충돌해 이전 방 데이터를 그대로 재사용하는 문제가 있었음.
const roomKey = computed(() => `room-data-${props.path}`)
const chatKey = computed(() => `chat-data-${props.path}`)

const { data: roomData } = await useAsyncData(
    roomKey,
    () => $fetch(`${apiBaseUrl}/api/getRoomByPath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: props.path }),
    }).then(res => (Array.isArray(res) && res.length > 0 ? res[0] : null)),
    { watch: [() => props.path] }
)

const serverAndRoomId = computed(() => ({
    serverid: props.id,
    roomid: roomData.value?.id ?? 0,
}))

const { data: chatData } = await useAsyncData(
    chatKey,
    () => $fetch(`${apiBaseUrl}/api/getChatsByRoomId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverAndRoomId.value),
    }).then(res => (Array.isArray(res) && res.length > 0 ? res : null)),
    { watch: [() => props.path] }
)

function isJSON(str) {
    try { JSON.parse(str); return true } catch { return false }
}

const mapType = computed(() => {
    const rawMap = roomData.value?.map
    return rawMap && !isJSON(rawMap) ? 'string' : 'object'
})
const mapInfo = computed(() => {
    const rawMap = roomData.value?.map
    if (!rawMap) return null
    return isJSON(rawMap) ? JSON.parse(rawMap) : rawMap
})

// 초기 HTTP 채팅 + WebSocket 실시간 채팅 합산 (ID 기준 중복 제거)
const chats = computed(() => {
    const base = chatData.value ?? []
    const seen = new Set(base.map(c => c.id))
    const fresh = realtimeChats.value.filter(c => !seen.has(c.id))
    return [...base, ...fresh]
})
const chatsWrapper = ref(null)

// 로컬 유저 위치 (다른 유저 아바타 상대 좌표 계산용)
const localPosition = ref({ x: 0, y: 0, roomPath: props.path })

// 스크롤 줌: 0.7 (최대 축소) ~ 2.5 (최대 확대)
// zoom=1.0 = 원본 isometric 뷰 (추가 스케일 없음)
const zoomLevel = ref(1)

// topRatio: 타일에서 바닥 면(상단)이 차지하는 비율
//   zoom=1.0 → 0.5 (표준 45° isometric)
//   줌아웃(zoom<1) → 0.5보다 높아짐 (하이앵글)
//   줌인(zoom>1)  → 0.5보다 낮아짐 (정면뷰)
const topRatio = computed(() => {
    // zoom-in: zoom=1.0 → 0.5, zoom=2.5 → 1/3 (기울기 1/9)
    // zoom-out: zoom=1.0 → 0.5, zoom=0.7 → ~0.584 (하이앵글)
    const raw = zoomLevel.value >= 1.0
        ? 0.5 - (zoomLevel.value - 1.0) / 9
        : 0.5 + (1.0 - zoomLevel.value) * 0.28
    return Math.max(1 / 3, Math.min(0.9, raw))
})

const { userId } = useCurrentUser()
const chatInput = ref('')
const chatInputEl = ref(null)

watch(chatInput, () => {
    nextTick(() => {
        if (!chatInputEl.value) return
        chatInputEl.value.style.height = 'auto'
        chatInputEl.value.style.height = Math.min(chatInputEl.value.scrollHeight, 120) + 'px'
    })
})
const chatSize = ref('little')
const showChatPanel = ref(true)
const showOverlay = ref(true)

// 맵 위치 reactive 상태 (직접 DOM 조작 대신 사용)
const mapLeft = ref(0)
const mapTop = ref(0)
const mapBlurred = ref(false)

const mapStyle = computed(() => ({
    left: `${mapLeft.value}px`,
    top: `${mapTop.value}px`,
}))

function updateMapPosition(pos) {
    mapLeft.value = pos.x * (-32)
    mapTop.value = Math.round(pos.y * topRatio.value * 64) + calcMapTopOffset()
}

// z=0 타일: 캐릭터 뒤에 렌더링
// z=0 레이어: 바닥 타일
const tilesBack = computed(() =>
    sortedTiles.value.filter(t => (t.position.z ?? 0) === 0)
)

// z≥1 타일: 정렬 불필요, 각자 z-index로 깊이 처리
const tilesFront = computed(() =>
    sortedTiles.value.filter(t => (t.position.z ?? 0) >= 1)
)

// 캐릭터 z-index: abs로 음수 좌표에서도 9900대 방지
// const charZIndex = computed(() =>
//     Math.floor((localPosition.value.x + localPosition.value.y - 0.5) * -10) + 9999
// )
const charZIndex = computed(() =>
    (localPosition.value.y) * -10 + 9999
)

// 이동/줌 조작이 막혀야 하는 상태 (채팅 확대 또는 오버레이가 떠 있음)
// 키보드/휠(onMounted)과 모바일 조이스틱/핀치줌 핸들러가 공유
const controlsBlocked = computed(() => {
    if (props.page === 'none' || props.page === 'room') {
        return showChatPanel.value && chatSize.value === 'large'
    }
    return showOverlay.value
})

// 모바일 조이스틱 노브 시각 위치
const joystickBase = ref(null)
const joystickKnobOffset = ref({ x: 0, y: 0 })
const joystickKnobStyle = computed(() => ({
    transform: `translate(${joystickKnobOffset.value.x}px, ${joystickKnobOffset.value.y}px)`,
}))

const OVERLAY_TYPES = ['board', 'info', 'members', 'settings', 'wiki', 'timeline']

function setBlurFromVoice(v) {
    mapBlurred.value = v
}

// props.page(룸 타입)가 바뀔 때 블러 초기화 — immediate로 첫 진입도 처리
watch(() => props.page, (newType) => {
    mapBlurred.value = OVERLAY_TYPES.includes(newType)
}, { immediate: true })

watch(() => route.params.page, (newPage) => {
    showOverlay.value = true
    showOverlay.value = true
    showChatPanel.value = true
    chatSize.value = 'little'
    // 페이지 전환 시 WS 룸 재참가
    const newPath = newPage ? `/${newPage}` : '/'
    joinRoom(newPath, userId.value, localPosition.value.x, localPosition.value.y)
})

// 실시간 채팅 수신 시 스크롤 하단 유지
watch(realtimeChats, () => {
    nextTick(() => {
        if (chatsWrapper.value) chatsWrapper.value.scrollTop = chatsWrapper.value.scrollHeight
    })
})

// 새 채팅이 오면 보낸 사람 캐릭터 머리 위에 말풍선 표시 (챗방/TTS방 공통)
const { showBubble } = useSpeechBubbles()
watch(realtimeChats, (list, prevList) => {
    const newOnes = list.slice(prevList?.length ?? 0)
    for (const chat of newOnes) showBubble(chat.userid, chat.content)
})

function toggleChatSize() {
    chatSize.value = chatSize.value === 'little' ? 'large' : 'little'
    mapBlurred.value = chatSize.value === 'large'
}

function closeChatPanel() {
    showChatPanel.value = false
    chatSize.value = 'little'
    mapBlurred.value = false
}

function closeOverlay() {
    showOverlay.value = false
    mapBlurred.value = false
}

function openOverlay() {
    showOverlay.value = true
    mapBlurred.value = true
}

function closeVoiceOverlay() {
    showOverlay.value = false
    mapBlurred.value = false
}

function openVoiceOverlay() {
    showOverlay.value = true
    // 블러는 WindowVoice가 mount되면서 setBlur emit으로 결정
}

// 아이소메트릭 depth sort: 큰 값이 앞에 그려짐
// elevation 1칸 = x+y 2칸에 해당하는 화면 깊이 (topRatio=0.5 기준 sideH/dynH*2 = 2)
const sortedTiles = computed(() => {
    if (!mapInfo.value || !mapInfo.value[0]) return []
    return [...mapInfo.value[0]].sort((a, b) => {
        const az = a.position.z ?? 0
        const bz = b.position.z ?? 0
        return (a.position.x + a.position.y + az * 2) - (b.position.x + b.position.y + bz * 2)
    })
})

const TILE_W = 128
const TILE_IMG_H = 128  // 타일 이미지는 정사각형(128×128) 가정

const charDepth = ref(0)

function getFilePath(tile) {
    return `/tileset/${tile.itemid}.png`
}

// 타일 컨테이너 위치
// Y step = topRatio * TILE_IMG_H 에 맞춰야 계단 현상이 없음.
// (step이 top face 높이와 불일치하면 overlap=0 → 계단처럼 보임)
function getTileContainerStyle(tile) {
    const { x, y, z = 0 } = tile.position
    // 렌더된 top face 높이 = topRatio * TILE_IMG_H
    // isometric에서 step = top face 높이의 절반
    const dynH = TILE_IMG_H * topRatio.value   // = rendered top face height
    const S = (1 - topRatio.value) * TILE_IMG_H
    // elevation = 렌더된 side 높이 (dynH/4 + S/2 + dynH/2) → z=1 바닥이 z=0 앞모서리에 정렬
    const sideH = dynH * 3 / 4 + S / 2
    const screenX = (x - y) * (TILE_W / 2)
    const screenY = (x + y) * (dynH / 2) - z * sideH
    const scale = (1 + (x + y) * 0.004).toFixed(3)
    const depthDiff = Math.abs((x + y) - charDepth.value)
    // zoom이 클수록 타일이 화면에서 커지므로 blur도 같이 강해보임 → zoomLevel로 보정
    const blur = (Math.min(depthDiff * 1.2, 6) / Math.max(zoomLevel.value, 1)).toFixed(1)
    return {
        left: `calc(50% + ${screenX - TILE_W / 2}px)`,
        top: `calc(50% + ${screenY - dynH / 2}px)`,
        transform: `scale(${scale})`,
        filter: Number(blur) > 0 ? `blur(${blur}px)` : undefined,
        zIndex: (x + y) * 10 + z * 2 + 10000,
    }
}

// ─── 타일 분할: 상단(바닥면) / 하단(옆면) ───────────────────
// 핵심: 각 슬라이스 안에서 이미지를 실제로 스케일링해서 비율 변화를 시각적으로 표현
// 이미지의 상단 절반(바닥면)은 topRatio*H 높이 공간에 맞게 늘어나거나 줄어듦
// 이미지의 하단 절반(옆면)은 (1-topRatio)*H 높이 공간에 맞게 변환

// 상단 슬라이스 컨테이너: 바닥면이 차지할 높이
const tileTopSliceStyle = computed(() => ({
    height: `${topRatio.value * TILE_IMG_H}px`,
}))
// 상단 이미지: 원래 이미지를 2*topRatio 배율로 y 스케일 → 상단 절반이 슬라이스를 채움
const tileTopImgStyle = computed(() => ({
    width: '128px',
    height: `${TILE_IMG_H * 2 * topRatio.value}px`,
}))

// 옆면 3분할 렌더링 (25/25/50)
// S = sideH = (1-topRatio)*128. 원본 이미지 기준:
//   상단 25%: 경계선 (고정)        rows 64–79  → rendered S/4
//   중간 25%: 흙 본체 (스트레치)   rows 80–95  → rendered S/4 base, grows z*S per level
//   하단 50%: 바닥 아트 전체 (고정) rows 96–127 → rendered S/2
// 전체 scaled 이미지 높이 = 2*S (배율 S/64 적용)
// 중간 pivot: row 80 → scaled y = 5S/4

// 상단 경계선: dynH/4 (확대할수록 짧아짐 — 가운데는 커지고 테두리는 얇아지는 효과)
const tileSideTopStyle = computed(() => ({
    height: `${topRatio.value * TILE_IMG_H / 4}px`,
}))
const tileSideTopImgStyle = computed(() => ({
    width: '128px',
    height: `${TILE_IMG_H * 2 * topRatio.value}px`,
    marginTop: `${-TILE_IMG_H * topRatio.value}px`,
}))

// 중간 스트레치: rows 80–95, pivot=row 80 → 5S/4 in 2S image
// middleBaseH = S/4, middleH = z*S + 3S/4, sf = 4z+3
function tileSideMiddleContainerStyle(tile) {
    const z = tile.position.z ?? 0
    const S = (1 - topRatio.value) * TILE_IMG_H
    //return { height: `${z * S + S / 2}px` }
    return { height: `${S / 2}px` }
}
function tileSideMiddleImgStyle(tile) {
    const z = tile.position.z ?? 0
    const S = (1 - topRatio.value) * TILE_IMG_H
    //const sf = 4 * z + 2
    const sf = 2
    return {
        width: '128px',
        height: `${2 * S * sf}px`,
        marginTop: `${-5 * S / 4 * sf}px`,
    }
}

// 하단 고정 S/2 (rows 96–127)
const tileSideBottomStyle = computed(() => ({
    height: `${(topRatio.value) * TILE_IMG_H / 2}px`,
}))
const tileSideBottomImgStyle = computed(() => ({
    width: '128px',
    height: `${(topRatio.value) * TILE_IMG_H * 2}px`,
    marginTop: `${-(topRatio.value) * TILE_IMG_H * 3 / 2}px`,
}))

// 타일 전체 CSS scale
// transformOrigin = 스크린 상 캐릭터 발 위치 (동적 추적)
//
// 문제 1: transformOrigin은 .maptiles1 로컬 좌표 기준.
//         WASD로 #map이 이동하면 스크린 기준 고정점이 어긋남.
// 문제 2: topRatio에 따라 charBottomSlice 높이가 바뀌고,
//         #character element 높이도 바뀜 → 발 위치(element bottom)도 변함.
//
// 해결:
//   ox = position.x * 32  (맵 좌우 이동 역보정)
//   charH = 64 (top slice) + charBottomH (topRatio에 따라 64~0)
//   feetOffset = charH / 2  (flex center → element bottom = center + charH/2)
//   oy = feetOffset - position.y * 32
const tilesScaleStyle = computed(() => {
    const ox = localPosition.value.x * 32
    // 타일 y 간격 = topRatio*64 per position unit (= dynH/2)
    // oy는 플레이어 타일 중심을 줌 피벗으로 고정하기 위한 보정값
    const oy = -localPosition.value.y * topRatio.value * 64
    return {
        transform: `scale(${zoomLevel.value})`,
        transformOrigin: `calc(50% + ${ox}px) calc(50% + ${oy}px)`,
    }
})

function handleChatEnter(event) {
    if (event.isComposing) return   // 한글 IME 조합 중 → 무시
    if (event.shiftKey) return      // Shift+Enter → 개행
    event.preventDefault()
    sendChat()
}

// WS 경유 채팅 전송
function sendChat() {
    if (!chatInput.value.trim()) return
    const content = chatInput.value.trim()
    chatInput.value = ''
    nextTick(() => { if (chatInputEl.value) chatInputEl.value.style.height = 'auto' })
    wsSendChat(serverAndRoomId.value.serverid, serverAndRoomId.value.roomid, content)
}

// 발끝 screen_y = center + (16 + charBotH) * z
// 타일 앞끝(Near corner) screen_y = center + offset + (dynH/2) * z
// → offset = (16 + charBotH − dynH/2) * z  (정확히 발끝 = 타일 앞끝)
function calcMapTopOffset() {
    const z = zoomLevel.value
    const charBotH = z >= 1 ? 64 : Math.round(31 + 33 * (z - 0.7) / 0.3)
    const dynH = topRatio.value * 128
    return Math.round((16 + charBotH - dynH / 2) * z)
}

// 다른 유저 아바타 위치: 로컬 유저 기준 상대 좌표 → 화면 좌표 (줌 포함)
// maptiles1 좌표계에 other user 배치 (zoom은 maptiles1이 담당)
// mapTop = localY*dynH/2 + tileOffset 이므로, tileOffset을 y에서 빼줘야
// 아바타 하단이 해당 유저의 캐릭터 발끝(= 로컬캐릭터 기준 50%+80px)에 맞도록 정렬

onMounted(() => {
    // 위치 복원
    const stored = localStorage.getItem('position')
    let position
    if (stored) {
        const parsed = JSON.parse(stored)
        position = parsed.roomPath !== props.path
            ? { roomPath: props.path, x: 0, y: 0 }
            : parsed
    } else {
        position = { roomPath: props.path, x: 0, y: 0 }
    }
    localStorage.setItem('position', JSON.stringify(position))
    localPosition.value = position
    charDepth.value = -position.y + 2
    updateMapPosition(position)

    // 현재 유저 캐릭터 데이터 로드
    ensureUserLoaded()

    // WebSocket 연결 및 룸 참가
    connect(apiBaseUrl)
    joinRoom(props.path, userId.value, position.x, position.y)

    // WASD 이동 (모바일 조이스틱과 한 칸 이동 로직 공유)
    const MOVE_KEYS = new Set(['KeyS', 'KeyW', 'KeyA', 'KeyD'])
    const MOVES = { KeyS: [0, -0.25], KeyW: [0, 0.25], KeyA: [-0.25, 0], KeyD: [0.25, 0] }

    function moveStep(code) {
        const delta = MOVES[code]
        if (!delta) return
        position.x += delta[0]
        position.y += delta[1]
        localPosition.value = { ...position }
        charDepth.value = -position.y + 2
        updateMapPosition(position)
        localStorage.setItem('position', JSON.stringify(position))
        sendPosition(position.x, position.y, code)
    }

    function onKeydown(e) {
        if (e.isSynthetic) return  // 조이스틱이 캐릭터 걷기 애니메이션만 재생시키려고 쏘는 합성 이벤트 — 이동은 moveStep이 직접 처리하므로 여기선 무시
        if (controlsBlocked.value) return
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        moveStep(e.code)
    }
    function onKeyup(e) {
        if (e.isSynthetic) return
        if (!MOVE_KEYS.has(e.code)) return
        sendPosition(position.x, position.y, null)
    }

    // CharacterMoving.vue는 실제 keydown/keyup(window)을 직접 리스닝해서 걷기 애니메이션을 재생함.
    // 조이스틱은 키보드가 아니라 터치라 그 이벤트가 발생하지 않으므로, 이동(moveStep)과는 별개로
    // 애니메이션 트리거용 합성 키 이벤트를 쏴서 같은 애니메이션 로직을 그대로 재사용한다.
    function dispatchSyntheticKey(type, code) {
        const ev = new KeyboardEvent(type, { code, bubbles: true })
        ev.isSynthetic = true
        window.dispatchEvent(ev)
    }

    // 휠/핀치 줌 (같은 clamp 로직 공유)
    function applyZoomDelta(delta) {
        zoomLevel.value = Math.max(0.7, Math.min(2.5, zoomLevel.value + delta))
        updateMapPosition(position)
    }

    const mapWrapper = document.querySelector('#map-wrapper')
    function onWheel(e) {
        if (controlsBlocked.value) return
        e.preventDefault()
        applyZoomDelta(e.deltaY > 0 ? -0.1 : 0.1)
    }

    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup)
    mapWrapper?.addEventListener('wheel', onWheel, { passive: false })

    // 핀치 줌 (두 손가락). 한 손가락 터치는 그대로 통과시켜 채팅 스크롤 등을 방해하지 않음
    let pinchStartDist = null
    function touchDistance(touches) {
        const [a, b] = touches
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    function onMapTouchStart(e) {
        if (e.touches.length === 2) pinchStartDist = touchDistance(e.touches)
    }
    function onMapTouchMove(e) {
        if (e.touches.length !== 2 || pinchStartDist === null) return
        if (controlsBlocked.value) return
        e.preventDefault()
        const dist = touchDistance(e.touches)
        const delta = (dist - pinchStartDist) * 0.004
        if (Math.abs(delta) > 0.003) {
            applyZoomDelta(delta)
            pinchStartDist = dist
        }
    }
    function onMapTouchEnd(e) {
        if (e.touches.length < 2) pinchStartDist = null
    }
    mapWrapper?.addEventListener('touchstart', onMapTouchStart, { passive: true })
    mapWrapper?.addEventListener('touchmove', onMapTouchMove, { passive: false })
    mapWrapper?.addEventListener('touchend', onMapTouchEnd, { passive: true })
    mapWrapper?.addEventListener('touchcancel', onMapTouchEnd, { passive: true })

    // 모바일 이동 조이스틱: 노브를 4방향(상/하/좌/우) 중 하나로 스냅해 누르는 동안 반복 이동
    const JOY_MAX_RADIUS = 32
    const JOY_REPEAT_MS = 180
    let joyTouchId = null
    let joyCenter = { x: 0, y: 0 }
    let joyActiveDir = null
    let joyInterval = null

    function directionFromDelta(dx, dy) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return null
        return Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'KeyD' : 'KeyA')
            : (dy > 0 ? 'KeyS' : 'KeyW')
    }

    function startJoystickMove(code) {
        dispatchSyntheticKey('keydown', code)
        moveStep(code)
        clearInterval(joyInterval)
        joyInterval = setInterval(() => {
            if (controlsBlocked.value) return
            moveStep(code)
        }, JOY_REPEAT_MS)
    }

    function stopJoystickMove(code) {
        clearInterval(joyInterval)
        joyInterval = null
        joystickKnobOffset.value = { x: 0, y: 0 }
        sendPosition(position.x, position.y, null)
        if (code) dispatchSyntheticKey('keyup', code)
    }

    function onJoystickTouchStart(e) {
        e.preventDefault()
        if (controlsBlocked.value) return
        const touch = e.changedTouches[0]
        joyTouchId = touch.identifier
        const rect = e.currentTarget.getBoundingClientRect()
        joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        joyActiveDir = null
    }

    function onJoystickTouchMove(e) {
        if (joyTouchId === null) return
        const touch = Array.from(e.changedTouches).find(t => t.identifier === joyTouchId)
        if (!touch) return
        e.preventDefault()
        const dx = touch.clientX - joyCenter.x
        const dy = touch.clientY - joyCenter.y
        const dist = Math.min(Math.hypot(dx, dy), JOY_MAX_RADIUS)
        const angle = Math.atan2(dy, dx)
        joystickKnobOffset.value = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }

        const dir = directionFromDelta(dx, dy)
        if (dir !== joyActiveDir) {
            clearInterval(joyInterval)
            joyInterval = null
            if (joyActiveDir) dispatchSyntheticKey('keyup', joyActiveDir)
            joyActiveDir = dir
            if (dir && !controlsBlocked.value) startJoystickMove(dir)
        }
    }

    function onJoystickTouchEnd(e) {
        if (joyTouchId === null) return
        const touch = Array.from(e.changedTouches).find(t => t.identifier === joyTouchId)
        if (!touch) return
        joyTouchId = null
        const dir = joyActiveDir
        joyActiveDir = null
        stopJoystickMove(dir)
    }

    const joyEl = joystickBase.value
    joyEl?.addEventListener('touchstart', onJoystickTouchStart, { passive: false })
    joyEl?.addEventListener('touchmove', onJoystickTouchMove, { passive: false })
    joyEl?.addEventListener('touchend', onJoystickTouchEnd, { passive: true })
    joyEl?.addEventListener('touchcancel', onJoystickTouchEnd, { passive: true })

    onUnmounted(() => {
        window.removeEventListener('keydown', onKeydown)
        window.removeEventListener('keyup', onKeyup)
        mapWrapper?.removeEventListener('wheel', onWheel)
        mapWrapper?.removeEventListener('touchstart', onMapTouchStart)
        mapWrapper?.removeEventListener('touchmove', onMapTouchMove)
        mapWrapper?.removeEventListener('touchend', onMapTouchEnd)
        mapWrapper?.removeEventListener('touchcancel', onMapTouchEnd)
        joyEl?.removeEventListener('touchstart', onJoystickTouchStart)
        joyEl?.removeEventListener('touchmove', onJoystickTouchMove)
        joyEl?.removeEventListener('touchend', onJoystickTouchEnd)
        joyEl?.removeEventListener('touchcancel', onJoystickTouchEnd)
        clearInterval(joyInterval)
    })
})
</script>

<style>
#map-wrapper {
    width: calc(100vw - 300px);
    height: calc(100dvh - 3rem);
    position: fixed;
    bottom: 0;
    right: 0;
    overflow: hidden;
    background-color: var(--mapbg);
    touch-action: pan-x pan-y;
}

/* 모바일 전용 이동 조이스틱: 기본 숨김, 768px 이하에서만 노출 */
#mobile-joystick {
    display: none;
    position: absolute;
    right: 20px;
    bottom: 20px;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: rgba(var(--fg-rgb),0.12);
    border: 1px solid rgba(var(--fg-rgb),0.25);
    z-index: 150;
    touch-action: none;
}

#joystick-knob {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 46px;
    height: 46px;
    margin: -23px 0 0 -23px;
    border-radius: 50%;
    background: rgba(var(--fg-rgb),0.55);
    transition: transform 0.05s linear;
}

@media (max-width: 768px) {
    #map-wrapper {
        width: 100vw;
    }

    #mobile-joystick {
        display: block;
    }
}

@keyframes handheld {
    0%   { transform: translate(0px,    0px)    rotate(0deg); }
    11%  { transform: translate(1.8px,  -1.2px) rotate(0.05deg); }
    23%  { transform: translate(-1.4px, 1.6px)  rotate(-0.04deg); }
    36%  { transform: translate(1.2px,  1.9px)  rotate(0.06deg); }
    48%  { transform: translate(-2px,   -1.3px) rotate(-0.05deg); }
    61%  { transform: translate(1.6px,  -1.8px) rotate(0.03deg); }
    74%  { transform: translate(-1.1px, 1.2px)  rotate(-0.04deg); }
    88%  { transform: translate(1.5px,  0.7px)  rotate(0.04deg); }
    100% { transform: translate(0px,    0px)    rotate(0deg); }
}

#map {
    width: 100%;
    height: 100%;
    position: relative;
    top: 0;
    left: 0;
    transition: filter 0.3s;
    animation: handheld 9s ease-in-out infinite;
}

#map.blur {
    filter: blur(1rem);
}

/* z≥1 레이어: 타일+캐릭터 통합 SC
   animation(transform 포함)이 SC를 생성 → 내부 position:fixed 요소들이 이 SC 내 DOM 순서로 레이어링됨 */
#map-front {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    transition: filter 0.3s;
    animation: handheld 9s ease-in-out infinite;
}

#map-front.blur {
    filter: blur(1rem);
}

/* 타일 그룹 pan 래퍼: mapStyle(left/top)을 받아 타일 좌표계를 팬 */
.maptiles-pan {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.maptempimg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
}

.maptiles1 {
    position: relative;
    width: 100%;
    height: 100%;
    /* transform: scale() 은 인라인 스타일로 적용됨 */
}

/* 타일 컨테이너 */
.tile-container {
    position: absolute;
    width: 128px;
}

/* 타일 상단/하단 슬라이스 */
.tile-slice {
    width: 128px;
    overflow: hidden;
}

.tile-img-full {
    display: block;
    width: 128px;
}

/* 다른 유저 아바타 */
.other-user-name {
    font-size: 0.7rem;
    color: white;
    background: rgba(0,0,0,0.55);
    padding: 1px 6px;
    border-radius: 6px;
    white-space: nowrap;
}

/* 채팅 패널 - 작은 상태 */
#chatroom-wrapper.little {
    width: calc(100% - 340px);
    max-width: 560px;
    height: 210px;
    position: absolute;
    z-index: 99;
    bottom: 14px;
    left: 14px;
    background-color: rgba(20,20,28,0.75);
    backdrop-filter: blur(8px);
    color: white;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(var(--fg-rgb),0.08);
}

/* 채팅 패널 - 큰 상태 */
#chatroom-wrapper.large {
    width: calc(100% - 100px);
    max-width: 800px;
    height: 60dvh;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 99;
    background-color: var(--surface-1-blur);
    backdrop-filter: blur(4px);
    color: rgba(var(--fg-rgb),0.85);
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: var(--modal-shadow);
}

#chats-wrapper {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex-grow: 1;
    overflow-y: auto;
}

.chat-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.msg :deep(p) {
    margin: 0;
}
.msg :deep(p + p) {
    margin-top: 0.35em;
}

.userchatbox .userinfo {
    margin-bottom: 2px;
}

.userinfo {
    display: flex;
    gap: 10px;
    align-items: center;
}

.datetime {
    font-size: 0.75rem;
    color: lightgray;
}

.large .datetime {
    color: #00000088;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
}

.avatar-placeholder {
    background-color: var(--bgaccent);
    border: 2px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.85rem;
}

#chatsender-wrapper {
    min-height: 2.5rem;
    display: flex;
    align-items: flex-end;
    border-top: 1px solid #ffffff44;
    flex-shrink: 0;
}

.large #chatsender-wrapper {
    border-top: 1px solid #00000022;
}

#chatsender-wrapper input,
#chatsender-wrapper textarea {
    background-color: transparent;
    border: 0;
    color: inherit;
    flex-grow: 1;
    font-size: 1rem;
    font-family: inherit;
    padding: 0.6rem 10px;
    outline: none;
}

.chat-textarea {
    resize: none;
    min-height: 2.5rem;
    max-height: 120px;
    line-height: 1.45;
    overflow-y: auto;
}

#sendchat {
    width: 60px;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--accent);
    color: rgba(var(--accent-fg-rgb),1);
    cursor: pointer;
    font-size: 0.9rem;
}

/* 채팅 패널 헤더도 항상 악센트 색 배경이라 배경 밝기에 맞춰 자동 대비 */
.chat-size-btn {
    background: none;
    border: none;
    color: rgba(var(--accent-fg-rgb),0.7);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 6px;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.1s, background 0.1s;
}
.chat-size-btn:hover { color: rgba(var(--accent-fg-rgb),1); background: rgba(var(--accent-fg-rgb),0.15); }

/* 공통 재열기 버튼 */
.reopen-btn {
    position: absolute;
    bottom: 14px;
    left: 14px;
    background-color: var(--accent);
    color: rgba(var(--accent-fg-rgb),1);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 99;
    font-size: 0.88rem;
    transition: opacity 0.15s;
}
.reopen-btn:hover { opacity: 0.85; }

#chatroom-wrapper .datetime { color: rgba(var(--fg-rgb),0.38); }
#chatroom-wrapper.large #chatsender-wrapper { border-top: 1px solid rgba(var(--fg-rgb),0.08); }

/* 모바일 채팅 패널 폭 보정: 위쪽 #chatroom-wrapper.little/.large 기본 규칙과
   동일 우선순위라 소스 순서상 반드시 뒤에 와야 이 값이 적용됨 */
@media (max-width: 768px) {
    #chatroom-wrapper.little {
        width: calc(100% - 154px);
        max-width: 400px;
        left: 12px;
    }

    #chatroom-wrapper.large {
        width: calc(100% - 24px);
    }
}
</style>
