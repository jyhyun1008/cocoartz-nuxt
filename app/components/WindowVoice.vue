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
const chatList = ref([])
const voiceSize = ref('large')
let lastChatId = 0
let pollTimer = null

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

async function sendChat() {
    if (!chatInput.value.trim()) return
    const content = chatInput.value.trim()
    chatInput.value = ''
    nextTick(() => { if (chatInputEl.value) chatInputEl.value.style.height = 'auto' })
    const newChat = await $fetch(`${apiBaseUrl}/api/sendChat`, {
        method: 'POST',
        body: { ...props.ids, userid: userId.value, content },
    })
    chatList.value.push(newChat)
    lastChatId = Math.max(lastChatId, newChat.id)
    speak(content, newChat.user?.knownas)
    scrollToBottom()
}

async function pollNewChats() {
    if (!props.ids.roomid) return
    try {
        const all = await $fetch(`${apiBaseUrl}/api/getChatsByRoomId`, {
            method: 'POST',
            body: props.ids,
        })
        if (!Array.isArray(all)) return
        const newOnes = all.filter(c => c.id > lastChatId && c.userid !== userId.value)
        if (!newOnes.length) return
        for (const chat of newOnes) {
            chatList.value.push(chat)
            speak(chat.content, chat.user?.knownas)
        }
        lastChatId = Math.max(...all.map(c => c.id))
        scrollToBottom()
    } catch {
        // 폴링 오류 무시
    }
}

onMounted(() => {
    emit('setBlur', voiceSize.value === 'large')
})

// roomid는 roomData 비동기 로딩 후 채워지므로 watch로 대기
watch(() => props.ids.roomid, async (roomid) => {
    if (!roomid) return
    if (pollTimer) clearInterval(pollTimer)

    const initial = await $fetch(`${apiBaseUrl}/api/getChatsByRoomId`, {
        method: 'POST',
        body: props.ids,
    })
    if (Array.isArray(initial) && initial.length) {
        chatList.value = initial
        lastChatId = initial[initial.length - 1].id
        scrollToBottom()
    }
    pollTimer = setInterval(pollNewChats, 5000)
}, { immediate: true })

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
    }
})
</script>

<style>
#voice-wrapper {
    color: white;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* 작은 상태 - 일반 채팅과 동일한 위치/크기 */
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
    border: 1px solid rgba(255,255,255,0.08);
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
    background-color: #1a1a22f0;
    backdrop-filter: blur(4px);
    border-radius: 16px;
    box-shadow: var(--modal-shadow);
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
    background: rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.6);
    letter-spacing: 0.04em;
    transition: all 0.2s;
}

.tts-badge.active {
    background: rgba(255,255,255,0.9);
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
