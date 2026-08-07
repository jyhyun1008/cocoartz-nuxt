<template>
    <div id="voice-wrapper" :class="voiceSize">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-volume-high"></i>
            <span style="flex:1">{{ voiceSize === 'little' ? '음성 채팅방' : '음성 채팅방' }}</span>
            <span class="tts-badge" :class="{ active: isSpeaking }">
                {{ isSpeaking ? '읽는 중' : 'TTS' }}
            </span>
            <button class="chat-size-btn" @click.stop="toggleSize">
                <i class="hgi hgi-stroke hgi-arrow-diagonal"
                   :style="voiceSize === 'large' ? 'transform:rotate(180deg)' : ''"></i>
            </button>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>
        <div id="voice-chats-wrapper" ref="chatsWrapper">
            <div v-for="chat in chatList" :key="chat.id" class="chat-wrapper">
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
                            <span class="datetime">{{ formatTime(chat.createdAt) }}</span>
                            <span v-if="chat.edited" class="edited-tag">(수정됨)</span>
                            <div v-if="chat.userid === userId && editingChatId !== chat.id" class="chat-msg-actions">
                                <button class="post-icon-btn" @click="startEditChat(chat)" title="수정">
                                    <i class="hgi hgi-stroke hgi-pencil-edit-02"></i>
                                </button>
                                <button class="post-icon-btn danger" @click="wsDeleteChat(chat.id)" title="삭제">
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
                    </template>
                </div>
            </div>
            <div v-if="!chatList.length" class="empty">아직 메시지가 없습니다. 입력하면 읽어줍니다.</div>
        </div>
        <div id="chatsender-wrapper">
            <textarea
                v-model="chatInput"
                ref="chatInputEl"
                placeholder="메시지 입력 (전송 시 읽어줍니다)"
                rows="1"
                class="chat-textarea"
                @keydown.enter="handleChatEnter"
            ></textarea>
            <div id="sendchat" @click="sendChat">전송</div>
        </div>
    </div>
</template>

<script setup>
import { marked } from 'marked'
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

// 우리 서버 커스텀 이모지(:shortcode:) — 채팅 메시지 표시 시점에 치환
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()

function renderMd(text) {
    return renderCustomEmojiText(String(marked.parse(text ?? '', { breaks: true })), customEmojiMap.value)
}

const emit = defineEmits(['close', 'setBlur'])

function handleChatEnter(event) {
    if (event.isComposing) return
    if (event.shiftKey) return
    event.preventDefault()
    sendChat()
}

const props = defineProps({
    ids: {
        type: Object,
        default: () => ({ serverid: 0, roomid: 0 }),
    },
})

const { sendChat: wsSendChat, editChat: wsEditChat, deleteChat: wsDeleteChat, realtimeChats } = useRoomSocket()
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
const isSpeaking = ref(false)
const chatsWrapper = ref(null)
const chatHistory = ref([])   // 방 입장 시 REST로 불러온 과거 채팅
const voiceSize = ref('large')

// 뮤트 — RoomMap.vue와 동일한 이유로, 실시간으로 들어오는 새 메시지는 여기서도 로컬 뮤트
// 목록 기준으로 한 번 더 걸러야 함(웹소켓 브로드캐스트는 뮤트를 모름)
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

// 과거 채팅(REST) + 실시간 채팅(WS) 합산 — 메인 챗방(RoomMap.vue)과 동일 패턴.
// realtimeChats에는 수정/삭제 마커(wsType)도 섞여 오므로 Map으로 반영(순서 유지)
const chatList = computed(() => {
    const map = new Map()
    for (const c of chatHistory.value) map.set(c.id, c)
    for (const item of realtimeChats.value) {
        if (item.wsType === 'chat_edit') {
            const existing = map.get(item.id)
            if (existing) map.set(item.id, { ...existing, content: item.content, edited: true })
        } else if (item.wsType === 'chat_delete') {
            map.delete(item.id)
        } else if (!map.has(item.id)) {
            const level = myLocalMutes.value.get(item.userid)
            if (level === 'hard') continue
            map.set(item.id, level === 'soft' ? { ...item, muted: 'soft' } : item)
        }
    }
    return [...map.values()]
})

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

// 채팅 메시지 작성자 뮤트 — RoomMap.vue와 동일한 패턴
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
    await loadMyMutes()
    await loadChatHistory()
}

const formatTime = formatDate

function toggleSize() {
    voiceSize.value = voiceSize.value === 'little' ? 'large' : 'little'
    emit('setBlur', voiceSize.value === 'large')
}

function speak(text, username) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(username ? `${username}. ${text}` : text)
    utterance.lang = 'ko-KR'
    utterance.rate = 1.0
    utterance.onstart = () => { isSpeaking.value = true }
    utterance.onend = () => { isSpeaking.value = false }
    window.speechSynthesis.speak(utterance)
}

function scrollToBottom() {
    nextTick(() => {
        if (chatsWrapper.value) chatsWrapper.value.scrollTop = chatsWrapper.value.scrollHeight
    })
}

function sendChat() {
    if (!chatInput.value.trim()) return
    const content = chatInput.value.trim()
    chatInput.value = ''
    nextTick(() => { if (chatInputEl.value) chatInputEl.value.style.height = 'auto' })
    // 서버 저장 + 브로드캐스트는 WS가 처리하고, 본인 화면 반영은 realtimeChats로 돌아오는 echo로 처리
    wsSendChat(props.ids.serverid, props.ids.roomid, content)
}

// 실시간(WS) 채팅 수신 시 TTS로 읽어주기 (본인 발화 포함 — echo로 한 번만 옴)
// 수정/삭제 마커(wsType)는 새 발화가 아니므로 TTS 대상에서 제외
watch(realtimeChats, (list, prevList) => {
    const newOnes = list.slice(prevList?.length ?? 0).filter(c => !c.wsType)
    for (const chat of newOnes) speak(chat.content, chat.user?.knownas)
    if (newOnes.length) scrollToBottom()
})

onMounted(() => {
    ensureCustomEmojisLoaded()
    emit('setBlur', voiceSize.value === 'large')
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mute-action-wrap')) activeMuteKey.value = null
    })
})

async function loadChatHistory() {
    if (!props.ids.roomid) return
    const initial = await $fetch(`${apiBaseUrl}/api/getChatsByRoomId`, {
        method: 'POST',
        body: { ...props.ids, userid: userId.value },
    }).catch(() => [])
    chatHistory.value = Array.isArray(initial) ? initial : []
    scrollToBottom()
}

// roomid는 roomData 비동기 로딩 후 채워지므로 watch로 대기
watch(() => props.ids.roomid, loadChatHistory, { immediate: true })

onUnmounted(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
    }
})
</script>

<style>
#voice-wrapper {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* 작은 상태 - 일반 채팅과 동일한 위치/크기, 항상 어두운 배경이라 흰 글자 고정 */
#voice-wrapper.little {
    width: calc(100% - 340px);
    max-width: 560px;
    height: 210px;
    position: absolute;
    z-index: 99;
    bottom: 14px;
    left: 14px;
    background-color: rgba(20,20,28,0.75);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    border: 1px solid rgba(var(--fg-rgb),0.08);
    color: white;
}

/* 큰 상태 */
#voice-wrapper.large {
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
    border-radius: 16px;
    box-shadow: var(--modal-shadow);
    color: rgba(var(--fg-rgb),1);
}

@media (max-width: 768px) {
    /* 음성방 작은창은 조이스틱이 뜨는 상태(page===room/none)와 동시에 나오는 일이 없어서
       채팅 작은창처럼 옆 공간을 비워둘 필요가 없음 — 그냥 넓게 씀 */
    #voice-wrapper.little {
        width: calc(100% - 24px);
    }

    #voice-wrapper.large {
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

.tts-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(var(--fg-rgb),0.15);
    color: rgba(var(--fg-rgb),0.6);
    letter-spacing: 0.04em;
    transition: all 0.2s;
}

.tts-badge.active {
    background: rgba(var(--fg-rgb),0.9);
    color: var(--accent);
    animation: tts-pulse 1s ease-in-out infinite;
}

@keyframes tts-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

#voice-chats-wrapper {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex-grow: 1;
    overflow-y: auto;
}

.msg p {
    margin: 0;
}
.msg p + p {
    margin-top: 0;
}
</style>
