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
                    <div class="userinfo">
                        <NuxtLink :to="chat.user?.username ? `/@${chat.user.username}` : '#'" class="knownas user-name-link">
                            {{ chat.user?.knownas ?? chat.user?.username }}
                        </NuxtLink>
                        <span class="datetime">{{ formatTime(chat.createdAt) }}</span>
                    </div>
                    <div class="msg" v-html="renderMd(chat.content)"></div>
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

function renderMd(text) {
    return String(marked.parse(text ?? '', { breaks: true }))
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

const { sendChat: wsSendChat, realtimeChats } = useRoomSocket()
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

// 과거 채팅(REST) + 실시간 채팅(WS) 합산, ID 기준 중복 제거 — 메인 챗방(RoomMap.vue)과 동일 패턴
const chatList = computed(() => {
    const seen = new Set(chatHistory.value.map(c => c.id))
    const fresh = realtimeChats.value.filter(c => !seen.has(c.id))
    return [...chatHistory.value, ...fresh]
})

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

function formatTime(str) {
    if (!str) return ''
    return str.split('T')[0] === today
        ? str.split('T')[1].slice(0, 5)
        : str.split('T')[0]
}

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
watch(realtimeChats, (list, prevList) => {
    const newOnes = list.slice(prevList?.length ?? 0)
    for (const chat of newOnes) speak(chat.content, chat.user?.knownas)
    if (newOnes.length) scrollToBottom()
})

onMounted(() => {
    emit('setBlur', voiceSize.value === 'large')
})

// roomid는 roomData 비동기 로딩 후 채워지므로 watch로 대기
watch(() => props.ids.roomid, async (roomid) => {
    if (!roomid) return
    const initial = await $fetch(`${apiBaseUrl}/api/getChatsByRoomId`, {
        method: 'POST',
        body: props.ids,
    })
    chatHistory.value = Array.isArray(initial) ? initial : []
    scrollToBottom()
}, { immediate: true })

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
    #voice-wrapper.little {
        width: calc(100% - 154px);
        max-width: 400px;
    }

    #voice-wrapper.large {
        width: calc(100% - 24px);
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

.msg :deep(p) {
    margin: 0;
}
.msg :deep(p + p) {
    margin-top: 0.35em;
}
</style>
