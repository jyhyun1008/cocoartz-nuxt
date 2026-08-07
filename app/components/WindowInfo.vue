<template>
    <div id="infowindow-wrapper">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-information-square"></i>
            <span>서버 정보</span>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>
        <div id="info-wrapper">
            <template v-if="server">
                <div id="info-banner">
                    <div id="info-avatar">
                        <NuxtImg v-if="server.avatar" :src="server.avatar" class="info-avatar-img" />
                        <div v-else class="info-avatar-initial">{{ (server.title ?? '?')[0] }}</div>
                    </div>
                    <div id="info-title-block">
                        <div id="info-title">{{ server.title }}</div>
                        <div id="info-meta">
                            <span><i class="hgi hgi-stroke hgi-calendar-01"></i> {{ formatDateOnly(server.createdAt) }} 개설</span>
                            <span><i class="hgi hgi-stroke hgi-door-01"></i> {{ registrationModeLabel }}</span>
                            <span v-if="roomCount"><i class="hgi hgi-stroke hgi-grid"></i> 방 {{ roomCount }}개</span>
                        </div>
                    </div>
                </div>

                <div v-if="server.info" class="info-section">
                    <div class="info-section-label">소개</div>
                    <div class="info-content md-content" v-html="renderMd(server.info)"></div>
                </div>
                <div v-else class="info-placeholder">아직 등록된 서버 소개가 없습니다.</div>
            </template>
            <div v-else class="info-placeholder">서버 정보를 불러오는 중...</div>
        </div>
    </div>
</template>

<script setup>
import { marked } from 'marked'

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const slug = config.public.serverSlug
defineEmits(['close'])

const { data: server } = await useAsyncData(
    'info-server',
    () => $fetch(`${apiBaseUrl}/api/getServerBySlug`, {
        method: 'POST',
        body: { slug },
    }).then(res => (Array.isArray(res) ? res[0] : res) ?? null),
)

function renderMd(text) {
    return String(marked.parse(text ?? '', { breaks: true }))
}

const registrationModeLabel = computed(() => {
    const mode = server.value?.registrationMode
    if (mode === 'approval') return '승인제 가입'
    if (mode === 'closed') return '가입 차단'
    return '자유 가입'
})

const roomCount = computed(() => {
    try {
        const parsed = JSON.parse(server.value?.rooms ?? '[]')
        return Array.isArray(parsed) ? parsed.length : 0
    } catch {
        return 0
    }
})
</script>

<style>
#infowindow-wrapper {
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

#info-wrapper {
    padding: 24px;
    font-size: 1rem;
    overflow-y: auto;
    flex-grow: 1;
}

.info-placeholder {
    color: rgba(var(--fg-rgb),0.3);
    margin: 0;
}

#info-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 18px;
    margin-bottom: 18px;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.08);
}

#info-avatar {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bgaccent, #D21F3C22);
    flex-shrink: 0;
}

.info-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.info-avatar-initial {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--accent, #D21F3C);
}

#info-title-block { min-width: 0; }

#info-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.92);
}

#info-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 6px;
    font-size: 0.82rem;
    color: rgba(var(--fg-rgb),0.4);
}
#info-meta span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.info-section-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(var(--fg-rgb),0.35);
    margin-bottom: 8px;
}

.info-content {
    line-height: 1.8;
    color: rgba(var(--fg-rgb),0.82);
    overflow-wrap: break-word;
    word-break: break-word;
}
.info-content p { margin: 0.5em 0; }
.info-content p:first-child { margin-top: 0; }
.info-content p:last-child { margin-bottom: 0; }

@media (max-width: 768px) {
    #infowindow-wrapper {
        width: calc(100% - 24px);
    }
}
</style>
