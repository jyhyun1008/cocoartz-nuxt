<template>
    <div id="map-wrapper">
        <!-- 문자열 타입(레거시) 맵: 이미지 한 장짜리 배경 -->
        <div v-if="mapType === 'string'" id="map" :style="mapStyle" :class="{ blur: mapBlurred }">
            <NuxtImg class="maptempimg" :src="mapInfo" />
        </div>

        <!-- 통합 레이어: 타일(z 무관) + 아이템 + 캐릭터 + 다른 유저 → 전부 같은 스태킹 컨텍스트에서
             z-index 하나로 깊이 결정. 예전엔 z=0 타일만 따로 떼서 항상 캐릭터 뒤(#map)에 고정해뒀는데,
             그러면 카메라에 더 가까운 z=0 타일이 그 위에 놓인 아이템(높이가 있는 스프라이트 스태킹)의
             아랫부분을 가려주지 못해서 부자연스러웠음(맵 편집기는 원래부터 이렇게 통합돼 있어서 자연스러웠음).
             -->
        <div v-else-if="mapInfo && mapInfo[0]" id="map-front" :class="{ blur: mapBlurred }">
            <div class="maptiles-pan" :style="mapStyle">
                <div class="maptiles1" :style="tilesScaleStyle">
                    <!-- 타일 (정렬 불필요, z-index가 깊이 담당) -->
                    <div
                        v-for="tile in sortedTiles"
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
                    <!-- 맵 아이템 (스프라이트 스태킹) — 맵 편집기에서 배치한 아이템(mapInfo[1])을 그대로 렌더 -->
                    <MapItem
                        v-for="(item, idx) in mapItems"
                        :key="`item-${item.position.x}-${item.position.y}-${item.position.z ?? 0}-${idx}`"
                        :layers="getItemLayers(item.itemid)"
                        :position="item.position"
                        :top-ratio="topRatio"
                        :blur-px="getDepthBlur(item.position.x + item.position.y)"
                        :flip-x="!!item.flip"
                        :flip-back="!!item.flipBack"
                        :flip-back-offsets="getItemFlipBackOffsets(item.itemid)"
                        :title="item.title"
                        :link="item.link"
                        interactive
                        :coin="!!coinBubbles[itemKey(item, idx)]"
                    />
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
                        :z-index="getOtherZIndex(other)"
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
                        <div v-if="chat.muted === 'soft' && !revealedMutedChats[chat.id]" class="remote-cw-gate">
                            <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 메시지입니다</div>
                            <button class="submit-btn" @click="revealedMutedChats[chat.id] = true">그래도 보기</button>
                        </div>
                        <template v-else>
                            <div class="userinfo">
                                <NuxtLink :to="chat.user?.username ? `/@${chat.user.username}` : '#'" class="knownas user-name-link">
                                    {{ chat.user?.knownas ?? chat.user?.username }}
                                </NuxtLink>
                                <span class="datetime">{{ formatDate(chat.createdAt) }}</span>
                                <span v-if="chat.edited" class="edited-tag">(수정됨)</span>
                                <div v-if="chat.userid === userId && editingChatId !== chat.id" class="chat-msg-actions">
                                    <button class="post-icon-btn" @click="startEditChat(chat)" title="수정">
                                        <i class="hgi hgi-stroke hgi-pencil-edit-02"></i>
                                    </button>
                                    <button class="post-icon-btn danger" @click="deleteChatMessage(chat)" title="삭제">
                                        <i class="hgi hgi-stroke hgi-delete-02"></i>
                                    </button>
                                </div>
                                <div v-if="chat.userid !== userId && userId" class="mute-action-wrap">
                                    <button class="post-icon-btn" @click.stop="toggleMuteMenu({ userid: chat.userid })" title="뮤트">
                                        <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                                    </button>
                                    <div v-if="activeMuteKey === muteKeyFor({ userid: chat.userid })" class="mute-menu" @click.stop>
                                        <button @click="confirmMuteChat({ userid: chat.userid }, 'soft')">소프트 뮤트</button>
                                        <button @click="confirmMuteChat({ userid: chat.userid }, 'hard')">하드 뮤트</button>
                                    </div>
                                </div>
                            </div>
                            <div v-if="editingChatId === chat.id" class="chat-edit-form">
                                <textarea
                                    v-model="editingContent"
                                    class="chat-textarea"
                                    rows="1"
                                    @keydown.enter.exact.prevent="submitEditChat(chat)"
                                    @keydown.esc="cancelEditChat"
                                ></textarea>
                                <div class="chat-edit-actions">
                                    <button class="back-btn-header" @click="cancelEditChat">취소</button>
                                    <button class="submit-btn" @click="submitEditChat(chat)" :disabled="!editingContent.trim()">저장</button>
                                </div>
                            </div>
                            <div v-else class="msg" v-html="renderMd(chat.content)"></div>
                            <div class="reactions-row chat-reactions-row">
                                <button
                                    v-for="r in getChatReactions(chat)"
                                    :key="r.emoji"
                                    class="reaction-pill"
                                    :class="{ reacted: r.reacted }"
                                    @click="toggleChatReaction(chat, r.emoji)"
                                >
                                    <span v-html="renderCustomEmojiText(escapeHtml(r.emoji), customEmojiMap)"></span> {{ r.count }}
                                </button>
                                <div class="emoji-picker-wrap">
                                    <button
                                        :ref="el => setChatReactionBtnRef(chat.id, el)"
                                        class="reaction-add-btn chat-reaction-add-btn"
                                        @click.stop="openChatReactionPicker(chat)"
                                    >+</button>
                                    <EmojiPicker
                                        v-if="activeReactionChatId === chat.id"
                                        :anchor="chatReactionAnchorEl"
                                        @select="(e) => { toggleChatReaction(chat, e); activeReactionChatId = null }"
                                    />
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
            <div id="chatsender-wrapper">
                <div class="chat-emoji-wrap" ref="chatEmojiWrapRef">
                    <button ref="chatEmojiBtnRef" id="chat-emoji-btn" type="button" @click.stop="showChatEmojiPicker = !showChatEmojiPicker" title="이모지">
                        <i class="hgi hgi-stroke hgi-smile"></i>
                    </button>
                    <EmojiPicker
                        v-if="showChatEmojiPicker"
                        :anchor="chatEmojiBtnRef"
                        @select="(e) => { insertChatEmoji(e); showChatEmojiPicker = false }"
                    />
                </div>
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

        <WindowBoard v-if="props.page === 'board' && showOverlay" :ids="serverAndRoomId" :is-federated="!!roomData?.federated" :room-name="roomData?.knownas" @close="closeOverlay" />
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
            :room-name="roomData?.knownas"
            @close="closeOverlay"
        />
        <div v-if="props.page === 'wiki' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-book-open-01"></i> 위키 열기
        </div>

        <WindowTimeline v-if="props.page === 'timeline' && showOverlay" @close="closeOverlay" />
        <div v-if="props.page === 'timeline' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-globe-02"></i> 타임라인 열기
        </div>

        <WindowPreferences v-if="props.page === 'preferences' && showOverlay" @close="closeOverlay" />
        <div v-if="props.page === 'preferences' && !showOverlay"
             class="reopen-btn" @click="openOverlay">
            <i class="hgi hgi-stroke hgi-user-settings-01"></i> 내 설정 열기
        </div>

        <!-- 모바일 전용 이동 조이스틱 (상/하/좌/우 4방향 스냅) -->
        <div
            v-show="!controlsBlocked"
            id="mobile-joystick"
            ref="joystickBase"
            :class="{ 'joystick-above-chat': isRoomPage && showChatPanel && chatSize === 'little' }"
        >
            <div id="joystick-knob" :style="joystickKnobStyle"></div>
        </div>

        <!-- 코인 획득 피드백 -->
        <div v-if="coinToastAmount !== null" class="coin-toast">
            +{{ coinToastAmount }} {{ server?.currencyName ?? '코코아' }}
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

// 재화(코인 수집) — 재화 이름(server.currencyName)을 토스트 라벨에 씀
const { server } = await useServer()
const { coins: coinBubbles, showCoin, hideCoin } = useCoinBubbles()

// 우리 서버 커스텀 이모지(:shortcode:) — 채팅 메시지/리액션 표시 시점에 치환
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()

function renderMd(text) {
    return renderCustomEmojiText(String(marked.parse(text ?? '', { breaks: true })), customEmojiMap.value)
}

const props = defineProps({
    id: { type: Number, required: true },
    page: { type: String, required: true },
    wikiSlug: { type: String, default: '' },
    path: { type: String, required: true },
})

const { connect, joinRoom, sendPosition, sendChat: wsSendChat, editChat: wsEditChat, deleteChat: wsDeleteChat, otherUsersInRoom, realtimeChats } = useRoomSocket()

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

const { userId, isLoggedIn } = useCurrentUser()

const { data: chatData, refresh: refreshChatData } = await useAsyncData(
    chatKey,
    () => $fetch(`${apiBaseUrl}/api/getChatsByRoomId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...serverAndRoomId.value, userid: userId.value }),
    }).then(res => (Array.isArray(res) && res.length > 0 ? res : null)),
    { watch: [() => props.path] }
)

// 뮤트 — 초기 채팅 목록(chatData)은 서버(getChatsByRoomId)가 이미 걸러서 내려주지만, 웹소켓으로
// 실시간으로 들어오는 새 메시지는 브로드캐스트 단계에서 뮤트를 모르므로 여기서 로컬(내 뮤트 목록)
// 기준으로 한 번 더 걸러야 함. 채팅은 로컬 유저만 있으므로 로컬 뮤트만 확인하면 됨.
const myLocalMutes = ref(new Map())
async function loadMyMutes() {
    if (!userId.value) { myLocalMutes.value = new Map(); return }
    const rows = await $fetch(`${apiBaseUrl}/api/getMutes`, { method: 'POST', body: { userid: userId.value } }).catch(() => [])
    myLocalMutes.value = new Map(
        (Array.isArray(rows) ? rows : []).filter(r => r.kind === 'local').map(r => [r.targetUserId, r.level]),
    )
}
loadMyMutes()
watch(userId, loadMyMutes)

// 재화 잔액 — key를 'balance-data-{serverid}' 형태로 고정해서 ServerProfilebar.vue가 같은 키로
// useAsyncData를 부르면 Nuxt가 데이터를 공유해줌(useServer()의 'server-data' 키랑 같은 요령) —
// 그래서 여기서 코인을 모아 balanceData.value를 갱신하면 프로필바 잔액 표시도 같이 바뀜
const { data: balanceData } = await useAsyncData(
    `balance-data-${props.id}`,
    () => $fetch(`${apiBaseUrl}/api/getMyBalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: userId.value, serverid: props.id }),
    }).catch(() => ({ balance: 0 })),
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

// 방에 처음 들어올 때 서는 위치 — 맵 편집기(WindowMapEditor.vue)에서 지정한 스폰 지점
// (mapInfo[2])을 읽음. 옛날 맵이라 없으면 예전부터 쓰던 기본값(0,0)으로 그대로 폴백
//
// ⚠️ 좌표계가 서로 다름: 맵 편집기가 저장하는 스폰 지점은 타일/아이템이랑 같은 격자 좌표(tx,ty —
// getTileContainerStyle의 x,y)인데, 캐릭터 위치(localPosition, CharacterMoving.vue의
// local-x/local-y)는 격자 좌표가 아니라 "화면 대각선 이동" 좌표라서 축 자체가 다름:
//   타일 화면 위치: screenX=(tx-ty)*TILE_W/2, screenY=(tx+ty)*dynH/2
//   캐릭터 화면 위치: screenX=localX*TILE_W/4, screenY=-localY*dynH/2
// 그대로 (tx,ty)를 캐릭터 위치에 넣으면 엉뚱한 화면 좌표로 계산돼서(실제로 스폰을 (2,2)로
// 찍었더니 캐릭터가 맵과 동떨어진 허공에 뜨는 버그가 있었음) 두 식이 같은 화면 좌표를 가리키도록
// 변환: localX = 2*(tx-ty), localY = -(tx+ty)
function getSpawnPoint() {
    const spawn = mapInfo.value?.[2]
    if (!spawn || typeof spawn.x !== 'number' || typeof spawn.y !== 'number') return { x: 0, y: 0 }
    return { x: 2 * (spawn.x - spawn.y), y: -(spawn.x + spawn.y) }
}

// 초기 HTTP 채팅 + WebSocket 실시간 채팅 합산. realtimeChats에는 새 채팅뿐 아니라 기존 메시지에
// 적용할 수정/삭제 마커(wsType)도 같이 들어오므로, Map으로 순서를 유지하면서 반영해야 함
// (Map.set은 이미 있는 키의 값만 바꾸고 순서는 그대로 유지하므로 정렬이 안 흐트러짐)
const chats = computed(() => {
    const map = new Map()
    for (const c of (chatData.value ?? [])) map.set(c.id, c)
    for (const item of realtimeChats.value) {
        if (item.wsType === 'chat_edit') {
            const existing = map.get(item.id)
            if (existing) map.set(item.id, { ...existing, content: item.content, edited: true })
        } else if (item.wsType === 'chat_delete') {
            map.delete(item.id)
        } else if (!map.has(item.id)) {
            // 실시간으로 새로 들어온 메시지는 브로드캐스트 단계에서 뮤트 필터링이 안 되므로 여기서 확인
            const level = myLocalMutes.value.get(item.userid)
            if (level === 'hard') continue
            map.set(item.id, level === 'soft' ? { ...item, muted: 'soft' } : item)
        }
    }
    return [...map.values()]
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

const chatInput = ref('')
const chatInputEl = ref(null)
const showChatEmojiPicker = ref(false)
const chatEmojiWrapRef = ref(null)
const chatEmojiBtnRef = ref(null)

function insertChatEmoji(emoji) {
    const el = chatInputEl.value
    if (!el) { chatInput.value += emoji; return }
    const start = el.selectionStart ?? chatInput.value.length
    const end = el.selectionEnd ?? chatInput.value.length
    chatInput.value = chatInput.value.slice(0, start) + emoji + chatInput.value.slice(end)
    nextTick(() => {
        el.focus()
        el.setSelectionRange(start + emoji.length, start + emoji.length)
    })
}

// 채팅 리액션: 로컬(chatData)/실시간(realtimeChats) 두 출처가 합쳐진 목록이라
// chat 객체를 직접 mutate하지 않고 별도 override 맵으로 관리 (읽기 전용 realtimeChats 보호)
const chatReactionOverride = ref({})
function getChatReactions(chat) {
    return chatReactionOverride.value[chat.id] ?? chat.reactions ?? []
}
async function toggleChatReaction(chat, emoji) {
    if (!userId.value) return
    const current = getChatReactions(chat)
    const existing = current.find(r => r.emoji === emoji)
    let next
    if (existing) {
        const updatedCount = existing.count + (existing.reacted ? -1 : 1)
        next = updatedCount <= 0
            ? current.filter(r => r.emoji !== emoji)
            : current.map(r => r.emoji === emoji ? { ...r, count: updatedCount, reacted: !existing.reacted } : r)
    } else {
        next = [...current, { emoji, count: 1, reacted: true }]
    }
    chatReactionOverride.value = { ...chatReactionOverride.value, [chat.id]: next }

    const result = await $fetch(`${apiBaseUrl}/api/reactChat`, {
        method: 'POST',
        body: { chatid: chat.id, userid: userId.value, emoji },
    })
    // 서버 응답과 낙관적 업데이트가 어긋나면(연타 등) 서버 값으로 재동기화
    const after = getChatReactions(chat)
    const afterEntry = after.find(r => r.emoji === emoji)
    if (afterEntry && afterEntry.reacted !== result.reacted) {
        const fixedCount = afterEntry.count + (result.reacted ? 1 : -1)
        const fixed = fixedCount <= 0
            ? after.filter(r => r.emoji !== emoji)
            : after.map(r => r.emoji === emoji ? { ...r, count: fixedCount, reacted: result.reacted } : r)
        chatReactionOverride.value = { ...chatReactionOverride.value, [chat.id]: fixed }
    }
}

const activeReactionChatId = ref(null)
const chatReactionAnchorEl = ref(null)
const chatReactionBtnRefs = {}
function setChatReactionBtnRef(chatId, el) {
    if (el) chatReactionBtnRefs[chatId] = el
}
function openChatReactionPicker(chat) {
    chatReactionAnchorEl.value = chatReactionBtnRefs[chat.id]
    activeReactionChatId.value = activeReactionChatId.value === chat.id ? null : chat.id
}

onMounted(() => {
    ensureCustomEmojisLoaded()
    document.addEventListener('click', (e) => {
        // 이모지 피커는 <body>로 teleport돼서 wrap의 DOM 자손이 아니므로 따로 예외 처리해야 함
        if (e.target.closest('.emoji-picker-popover')) return
        if (chatEmojiWrapRef.value && !chatEmojiWrapRef.value.contains(e.target))
            showChatEmojiPicker.value = false
        if (!e.target.closest('.chat-reaction-add-btn'))
            activeReactionChatId.value = null
        if (!e.target.closest('.mute-action-wrap'))
            activeMuteKey.value = null
    })
})

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

// (x,y) 칸(반올림)에 있는 "가리는 것"(아이템 전부 + z≥1 타일)들의 z-index 중 최솟값.
// 0층 바닥타일은 절대 캐릭터를 못 가리는 예외라서 여기 집계에서 뺌.
// 타일/아이템 z-index는 getTileContainerStyle / MapItem.vue의 defaultZIndex랑 완전히 같은
// 4n+k 공식으로 재계산함(같은 척도라야 "바로 아래" 비교가 의미 있음).
function getBlockersMinZ(x, y) {
    const cx = Math.round(x)
    const cy = Math.round(y)
    let min = null
    const consider = (z) => { if (min === null || z < min) min = z }
    for (const t of mapInfo.value?.[0] ?? []) {
        const tz = t.position.z ?? 0
        if (t.position.x === cx && t.position.y === cy && tz >= 1) {
            consider(4 * (t.position.x + t.position.y + 2 * tz) + tz)
        }
    }
    for (const it of mapInfo.value?.[1] ?? []) {
        const iz = it.position.z ?? 0
        if (it.position.x === cx && it.position.y === cy) {
            consider(4 * (it.position.x + it.position.y + 2 * iz) + (iz + 1))
        }
    }
    return min
}

// 캐릭터 z-index: 타일/아이템이랑 같은 4n+k 척도(n=x+y, k=1 — 0층 바닥(k=0)보다는 항상 위).
// 단, 지금 서 있는 칸(반올림)에 아이템이나 z≥1 블록이 있으면 실제 깊이 계산 없이 무조건
// 그것들 바로 뒤(최솟값-1)로 깔아버림 — "같은 칸에 있으면 캐릭터가 무조건 뒤" 규칙.
// (같은 칸이 아니라 스치듯 지나가는 순간에 훅 나타났다 사라지는 건 알고 있는 한계 — 나중에 다듬을 예정)
// ⚠️ CSS z-index는 정수만 허용 — 캐릭터는 0.25칸 단위로 움직이는데 4*(0.25의 배수)는 항상
// 정수라 원래는 괜찮지만, 부동소수점 오차로 아주 드물게 어긋날 수 있어 Math.round로 방어.
function getCharZIndex(x, y) {
    // const blockerZ = getBlockersMinZ(x, y)
    // if (blockerZ !== null) return blockerZ - 1
    return (-4 * Math.round((y)*1) + 4)
}

const charZIndex = computed(() => getCharZIndex(localPosition.value.x, localPosition.value.y))

// 다른 유저 z-index: local-x/y가 로컬 유저 기준 상대 오프셋이라 절대 좌표로 바꿔서 같은 공식 적용
function getOtherZIndex(other) {
    const ax = localPosition.value.x + other.x
    const ay = localPosition.value.y + other.y
    return getCharZIndex(ax, ay)
}

const isRoomPage = computed(() => props.page === 'none' || props.page === 'room')

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

watch(() => route.params.page, () => {
    showOverlay.value = true
    showOverlay.value = true
    showChatPanel.value = true
    chatSize.value = 'little'
    // WS 룸 재참가 + 스폰 위치 반영은 아래 roomData 워처가 담당함 — 여기서 바로 joinRoom을 부르면
    // roomData(=이 방의 스폰 지점)가 아직 이전 방 것 그대로라(useAsyncData 갱신이 비동기라 한 틱
    // 늦게 옴) 스폰이 아니라 이전 방에서 서 있던 좌표로 잘못 참가하게 됨
})

// 방(props.path)이 바뀌어서 roomData가 새 방 데이터로 갱신되면, 그 방의 스폰 지점으로 위치를
// 리셋하고 새로 join — localPosition.roomPath가 이미 현재 방과 같으면(같은 방 안에서 맵만
// 다시 저장되는 경우 등) 위치는 안 건드림. onMounted가 이미 첫 진입은 처리하므로 여기선
// "방이 실제로 바뀐" 경우만 걸러내면 됨(immediate 안 씀 — 초기 진입 시 이 워처가 또 안 겹치게)
watch(roomData, () => {
    if (!roomData.value) return
    if (localPosition.value.roomPath === props.path) return
    const position = { roomPath: props.path, ...getSpawnPoint() }
    localStorage.setItem('position', JSON.stringify(position))
    localPosition.value = position
    charDepth.value = -position.y + 2
    updateMapPosition(position)
    joinRoom(props.path, userId.value, position.x, position.y)
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

// 맵에 배치된 아이템 — mapInfo[0]이 타일 배열이듯, mapInfo[1]이 아이템 배열.
// 맵 편집기(WindowMapEditor)에서 저장한 위치/itemid를 그대로 읽어와 렌더만 함
const { getItemLayers, getItemFlipBackOffsets } = useItemCatalog()
const mapItems = computed(() => mapInfo.value?.[1] ?? [])

// 아이템 하나를 가리키는 안정적인 키 — MapItem :key로 쓰는 것과 같은 좌표 조합(코인 상태를
// 이 키로 관리하니 같은 아이템은 항상 같은 키를 가리켜야 함)
function itemKey(item, idx) {
    return `${item.position.x}-${item.position.y}-${item.position.z ?? 0}-${idx}`
}

// ─── 재화: 코인 랜덤 스폰 + 수집 판정 ──────────────────────────
// 나(이 브라우저)한테만 보이는 연출이라 서버로 동기화하지 않음 — 그래서 아래 타이머로 그냥
// 로컬에서 랜덤하게 켬. 한 번에 하나만 떠 있게 해서 화면이 어지럽지 않게 함.
// 5분에 한 번씩 등장(1분간 유지 — useCoinBubbles.ts의 COIN_DURATION_MS)
const COIN_SPAWN_INTERVAL_MS = 5 * 60 * 1000
let coinSpawnTimer = null

function maybeSpawnCoin() {
    // 로그아웃 상태(구경만 하는 손님)한테는 어차피 못 먹으니 아예 안 띄움 — 안 그러면 코인이
    // 뜨는데 지나가도 안 먹히는(collectCoin이 401로 조용히 실패하는) 것처럼 보임
    if (!isLoggedIn.value) return
    if (Object.keys(coinBubbles.value).length > 0) return
    if (!mapItems.value.length) return
    const idx = Math.floor(Math.random() * mapItems.value.length)
    showCoin(itemKey(mapItems.value[idx], idx))
}

const coinToastAmount = ref(null)
let coinToastTimer = null
function showCoinToast(amount) {
    coinToastAmount.value = amount
    clearTimeout(coinToastTimer)
    coinToastTimer = setTimeout(() => { coinToastAmount.value = null }, 1500)
}

async function collectCoin() {
    try {
        const res = await $fetch(`${apiBaseUrl}/api/collectCoin`, {
            method: 'POST',
            body: { userid: userId.value, serverid: props.id },
        })
        if (!res?.ok) return  // 서버 쿨다운 등으로 거절됨 — 배지는 이미 사라졌으니 조용히 무시
        balanceData.value = { balance: res.balance }
        showCoinToast(res.amount)
    } catch { /* 네트워크 오류 등 — 조용히 무시 */ }
}

// 캐릭터 위치(localPosition, 화면 대각선 이동 좌표)를 타일 격자 좌표로 되돌려서(스폰 지점 변환의
// 역방향 — 위 getSpawnPoint 주석 참고) 지금 서 있는 칸에 코인이 떠 있는 아이템이 있는지 확인.
// 같은 칸에 가만히 있는 동안(예: 이동 키를 눌렀지만 칸 경계는 안 넘은 잔이동)은 수집되면 안 되고,
// 실제로 "칸을 옮겨야"(다른 칸에 있다가 그 칸으로 들어와야) 먹히게 함 — lastCheckedTile로 직전
// 판정 때의 칸과 비교해서 실제로 바뀐 경우에만 검사
const lastCheckedTile = ref({ x: null, y: null })
function checkCoinCollection() {
    // 코인 뜬 채로(1분 이내) 로그아웃하는 극단적인 경우까지 대비 — 로그인 안 된 상태면 판정 자체를 건너뜀
    if (!isLoggedIn.value) return
    const lx = localPosition.value.x
    const ly = localPosition.value.y
    const tx = Math.round(lx / 4 - ly / 2)
    const ty = Math.round(-ly / 2 - lx / 4)
    const moved = tx !== lastCheckedTile.value.x || ty !== lastCheckedTile.value.y
    lastCheckedTile.value = { x: tx, y: ty }
    if (!moved) return
    if (!Object.keys(coinBubbles.value).length) return
    mapItems.value.forEach((item, idx) => {
        const key = itemKey(item, idx)
        if (!coinBubbles.value[key]) return
        if (item.position.x !== tx || item.position.y !== ty) return
        hideCoin(key)  // 낙관적으로 즉시 지움 — 다시 왔다갔다해도 중복 수집 시도 안 함
        collectCoin()
    })
}
watch(() => localPosition.value, checkCoinCollection)

onMounted(() => {
    coinSpawnTimer = setInterval(maybeSpawnCoin, COIN_SPAWN_INTERVAL_MS)
})
onUnmounted(() => {
    if (coinSpawnTimer) clearInterval(coinSpawnTimer)
    clearTimeout(coinToastTimer)
})

const charDepth = ref(0)

function getFilePath(tile) {
    return `/tileset/${tile.itemid}.png`
}

// 피사계심도(초점 흐림): 캐릭터가 있는 깊이(x+y)에서 멀어질수록 흐려짐. 타일뿐 아니라
// 아이템에도 그대로 씀 — depth(=x+y)만 넣어주면 동일한 흐림값을 돌려줌
function getDepthBlur(depth) {
    const depthDiff = Math.abs(depth - charDepth.value)
    // zoom이 클수록 화면에서 커지므로 blur도 같이 강해보임 → zoomLevel로 보정
    return (Math.min(depthDiff * 1.2, 6) / Math.max(zoomLevel.value, 1)).toFixed(1)
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
    const blur = getDepthBlur(x + y)
    // z-index = 4n + k (n = 화면상 깊이 슬롯, k = 그 슬롯 안에서의 높이 순번 0~3).
    // n=x+y, k=z(0~2)는 그 타일 자신의 층 — 같은 (x+y)를 가진 타일끼리는 층(z)으로만 순서가
    // 갈림. 아이템(MapItem.vue의 defaultZIndex)은 n=x+y+2z, k=z+1로 스케일이 달라서 타일과
    // 정확히 같은 슬롯을 공유하진 않지만, 실제 배치에서 문제되는 조합은 sortedTiles의 DOM
    // 순서(아래 x+y+2z 기준 정렬)가 동률 구간을 추가로 보정해줘서 지금 보이는 결과가 맞음
    // — 캐릭터 z-index는 아직 이 스킴에 안 맞춰져 있음(별도로 손볼 예정, 지금은 그대로 둠).
    const n = x + y
    const k = z
    const zIndex = 4 * n + k
    return {
        left: `calc(50% + ${screenX - TILE_W / 2}px)`,
        top: `calc(50% + ${screenY - dynH / 2}px)`,
        transform: `scale(${scale})`,
        filter: Number(blur) > 0 ? `blur(${blur}px)` : undefined,
        zIndex,
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

// 채팅 수정/삭제 — 삭제는 확인 모달 없이 바로 지움(가벼운 메시지라 되돌릴 필요까진 없다고 판단)
const editingChatId = ref(null)
const editingContent = ref('')

function startEditChat(chat) {
    editingChatId.value = chat.id
    editingContent.value = chat.content
}
function cancelEditChat() {
    editingChatId.value = null
    editingContent.value = ''
}
function submitEditChat(chat) {
    const content = editingContent.value.trim()
    if (!content) return
    wsEditChat(chat.id, content)
    editingChatId.value = null
    editingContent.value = ''
}
function deleteChatMessage(chat) {
    wsDeleteChat(chat.id)
}

// 채팅 메시지 작성자 뮤트 — 다른 콘텐츠(게시판/타임라인)와 동일한 패턴. 채팅은 로컬 유저만
// 있으므로 로컬 뮤트만 다룸. 뮤트 직후 초기 로드분(chatData)도 다시 걸러지도록 새로고침하고,
// 실시간으로 들어올 메시지를 위해 내 뮤트 목록(myLocalMutes)도 갱신
const activeMuteKey = ref(null)
const revealedMutedChats = ref({})
function muteKeyFor(target) {
    return `local-${target.userid}`
}
function toggleMuteMenu(target) {
    const key = muteKeyFor(target)
    activeMuteKey.value = activeMuteKey.value === key ? null : key
}
async function confirmMuteChat(target, level) {
    if (!userId.value) return
    await $fetch(`${apiBaseUrl}/api/muteUser`, {
        method: 'POST',
        body: { userid: userId.value, targetUserId: target.userid, level },
    }).catch(() => {})
    activeMuteKey.value = null
    await Promise.all([loadMyMutes(), refreshChatData()])
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
            ? { roomPath: props.path, ...getSpawnPoint() }
            : parsed
    } else {
        position = { roomPath: props.path, ...getSpawnPoint() }
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

    // 핀치 줌 (두 손가락) + 한 손가락 세로 드래그 줌.
    // 채팅/조이스틱/버튼/오버레이 창 등은 전부 pointer-events가 있어서 터치하면 e.target이 그
    // 요소 자신이 됨 — #map-front는 pointer-events:none이라 맵 위를 터치하면 통과해서 e.target이
    // #map-wrapper 자체가 됨. 그래서 "e.target===mapWrapper"만 맵 배경 터치로 취급하면
    // 채팅 스크롤 등 다른 UI의 한 손가락 터치는 그대로 안 건드리고 지나감.
    let pinchStartDist = null
    let singleTouchY = null
    function touchDistance(touches) {
        const [a, b] = touches
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    function onMapTouchStart(e) {
        if (e.touches.length === 2) {
            pinchStartDist = touchDistance(e.touches)
            singleTouchY = null
        } else if (e.touches.length === 1 && e.target === mapWrapper) {
            singleTouchY = e.touches[0].clientY
        } else {
            singleTouchY = null
        }
    }
    function onMapTouchMove(e) {
        if (controlsBlocked.value) return
        if (e.touches.length === 2 && pinchStartDist !== null) {
            e.preventDefault()
            const dist = touchDistance(e.touches)
            const delta = (dist - pinchStartDist) * 0.004
            if (Math.abs(delta) > 0.003) {
                applyZoomDelta(delta)
                pinchStartDist = dist
            }
            return
        }
        if (e.touches.length === 1 && singleTouchY !== null) {
            const y = e.touches[0].clientY
            const dy = y - singleTouchY
            // 아래로 드래그 = 확대, 위로 드래그 = 축소 (당겨서 확대하는 느낌)
            if (Math.abs(dy) > 2) {
                e.preventDefault()
                applyZoomDelta(dy * 0.005)
                singleTouchY = y
            }
        }
    }
    function onMapTouchEnd(e) {
        if (e.touches.length < 2) pinchStartDist = null
        if (e.touches.length < 1) singleTouchY = null
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

/* 코인 획득 피드백 — 화면 위쪽 가운데 고정, WindowWiki.vue 등의 .share-toast와 같은
   fade-in-out 연출(로컬 상태 + setTimeout으로 스스로 사라짐) */
.coin-toast {
    position: absolute;
    left: 50%;
    top: 18%;
    transform: translateX(-50%);
    background: linear-gradient(145deg, #ffe17d, #f4b400);
    color: #7a4a00;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.9rem;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    white-space: nowrap;
    pointer-events: none;
    z-index: 99999;
    animation: coin-toast-fade 1.5s ease forwards;
}

@keyframes coin-toast-fade {
    0% { opacity: 0; transform: translateX(-50%) translateY(6px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
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
    background: var(--surface-1-blur);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(var(--fg-rgb),0.15);
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

    /* 채팅 작은창이 떠 있을 땐 창을 옆이 아니라 최대한 넓게 쓰고, 조이스틱을 그 위로 올림 */
    #mobile-joystick.joystick-above-chat {
        bottom: 244px;
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
    background-color: var(--surface-1-blur);
    backdrop-filter: blur(8px);
    color: rgba(var(--fg-rgb),0.85);
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

.userchatbox {
    flex: 1;
    min-width: 0;
}

.msg {
    overflow-wrap: break-word;
    word-break: break-word;
}
.msg p {
    margin: 0;
}
.msg p + p {
    margin-top: 0;
}

.userchatbox .userinfo {
    margin-bottom: 0;
    line-height: 1.2;
}

.userinfo {
    display: flex;
    gap: 10px;
    align-items: center;
}

.knownas {
    font-weight: 700;
}

.reactions-row.chat-reactions-row {
    padding: 4px 0 0;
}

.reaction-add-btn.chat-reaction-add-btn {
    width: 22px;
    height: 22px;
    font-size: 0.8rem;
}

.datetime {
    font-size: 0.75rem;
    color: lightgray;
}

.large .datetime {
    color: #00000088;
}

.edited-tag {
    font-size: 0.72rem;
    color: lightgray;
    opacity: 0.7;
}

.large .edited-tag {
    color: #00000088;
}

.chat-msg-actions {
    display: flex;
    gap: 2px;
    margin-left: auto;
}

.chat-edit-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 4px 0;
}

.chat-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
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

.chat-emoji-wrap {
    position: relative;
    align-self: stretch;
    display: flex;
}

#chat-emoji-btn {
    width: 2.5rem;
    border: none;
    background: none;
    color: rgba(var(--fg-rgb),0.45);
    font-size: 1.1rem;
    cursor: pointer;
    transition: color 0.1s;
}
#chat-emoji-btn:hover { color: rgba(var(--fg-rgb),0.8); }

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
    /* 조이스틱은 작은창 위로 올라가므로(.joystick-above-chat) 옆 공간을 더 안 비워도 됨 */
    #chatroom-wrapper.little {
        width: calc(100% - 24px);
        left: 12px;
    }

    #chatroom-wrapper.large {
        left: 12px;
        right: 12px;
        top: 12px;
        bottom: 14px;
        transform: none;
        width: auto;
        max-width: none;
        height: auto;
    }
}
</style>
