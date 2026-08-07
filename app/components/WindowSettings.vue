<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-setting-07"></i>
            <span v-if="view === 'list'">서버 설정 / 채널 관리</span>
            <span v-else-if="view === 'create'">새 채널 만들기</span>
            <span v-else-if="view === 'edit'">채널 편집</span>
            <span v-else-if="view === 'map-edit'">채널 맵 편집</span>
            <button v-if="view !== 'list'" class="back-btn-header" @click="view === 'map-edit' ? closeMapEdit() : (view = 'list')">← 뒤로</button>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>

        <!-- 비로그인 -->
        <div v-if="!isLoggedIn" id="settings-content">
            <p class="info-placeholder">설정을 변경하려면 로그인이 필요합니다.</p>
        </div>

        <!-- 채널 목록 -->
        <div v-else-if="view === 'list'" id="settings-content">

            <!-- 서버 정보 섹션 -->
            <div class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">서버 정보</span>
                </div>

                <label class="admin-label">서버 이름</label>
                <input v-model="serverForm.title" placeholder="서버 이름" class="post-input" />

                <label class="admin-label">악센트 컬러</label>
                <div class="admin-color-row">
                    <input type="color" v-model="serverForm.themecolor" class="admin-color-input" />
                    <input v-model="serverForm.themecolor" placeholder="#D21F3C" class="post-input" style="flex:1" />
                </div>

                <label class="admin-label">서버 소개 <span class="admin-label-hint">선택</span></label>
                <textarea v-model="serverForm.info" placeholder="서버 소개..." class="post-textarea" style="min-height:60px"></textarea>

                <label class="admin-label">서버 아이콘 <span class="admin-label-hint">선택</span></label>
                <div class="admin-icon-row">
                    <div class="admin-icon-preview">
                        <NuxtImg v-if="serverForm.avatar" :src="serverForm.avatar" class="admin-icon-preview-img" />
                        <i v-else class="hgi hgi-stroke hgi-image-02"></i>
                    </div>
                    <input v-model="serverForm.avatar" placeholder="https://example.com/icon.png" class="post-input" style="flex:1" />
                    <template v-if="objectStorageEnabled">
                        <input type="file" ref="serverIconFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleServerIconFile" />
                        <button class="admin-add-btn" style="margin-left:0" @click="serverIconFileInput?.click()" :disabled="serverIconUploading">
                            {{ serverIconUploading ? '업로드 중...' : '업로드' }}
                        </button>
                    </template>
                </div>

                <label class="admin-label">가입 방식</label>
                <select v-model="serverForm.registrationMode" class="admin-select">
                    <option value="open">자유 가입</option>
                    <option value="approval">승인제 가입</option>
                    <option value="closed">가입 차단</option>
                </select>

                <p v-if="serverError" class="admin-error">{{ serverError }}</p>
                <button class="submit-btn" style="margin-top:8px;align-self:flex-start" @click="submitServerInfo" :disabled="serverSaving">
                    {{ serverSaving ? '저장 중...' : '서버 정보 저장' }}
                </button>
                <p v-if="serverSaveMsg" class="admin-save-msg">{{ serverSaveMsg }}</p>
            </div>

            <!-- 커스텀 이모지 관리 -->
            <div class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">커스텀 이모지 관리</span>
                </div>
                <p class="admin-label-hint" style="margin:-4px 0 10px">
                    게시판/채팅/위키 본문과 리액션에서 :샷코드: 로 쓸 수 있고, 연합 게시판에 올라간 글은 다른 서버에서도 이미지로 보여요.
                </p>

                <div class="admin-channel-list">
                    <div v-for="e in customEmojiList" :key="e.shortcode" class="admin-channel-item">
                        <div class="admin-icon-preview" style="width:28px;height:28px">
                            <NuxtImg :src="e.imageUrl" class="admin-icon-preview-img" />
                        </div>
                        <span class="admin-ch-name">:{{ e.shortcode }}:</span>
                        <div class="admin-ch-actions">
                            <button class="admin-icon-btn danger" @click="deleteCustomEmoji(e.id)" title="삭제">
                                <i class="hgi hgi-stroke hgi-delete-02"></i>
                            </button>
                        </div>
                    </div>
                    <div v-if="!customEmojiList.length" class="empty" style="padding:14px 0">등록된 커스텀 이모지가 없습니다.</div>
                </div>

                <template v-if="objectStorageEnabled">
                    <label class="admin-label">새 이모지 추가</label>
                    <div class="admin-icon-row">
                        <input v-model="newEmojiShortcode" placeholder="샷코드 (영문 소문자/숫자/밑줄, 콜론 없이)" class="post-input" style="flex:1" />
                        <input type="file" ref="emojiFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleCustomEmojiFile" />
                        <button class="admin-add-btn" style="margin-left:0" @click="emojiFileInput?.click()" :disabled="customEmojiUploading || !newEmojiShortcode.trim()">
                            {{ customEmojiUploading ? '업로드 중...' : '이미지 선택 후 업로드' }}
                        </button>
                    </div>
                </template>
                <p v-else class="admin-label-hint">오브젝트 스토리지가 설정되지 않아 이모지를 업로드할 수 없어요.</p>
                <p v-if="customEmojiError" class="admin-error">{{ customEmojiError }}</p>
            </div>

            <!-- 승인 대기 중인 가입 신청 -->
            <div v-if="serverForm.registrationMode === 'approval' || pendingUsers.length" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">가입 승인 대기</span>
                </div>
                <div class="admin-channel-list">
                    <div v-for="p in pendingUsers" :key="p.id" class="admin-channel-item">
                        <div class="admin-icon-preview" style="width:28px;height:28px;border-radius:50%">
                            <NuxtImg v-if="p.avatar" :src="p.avatar" class="admin-icon-preview-img" />
                            <i v-else class="hgi hgi-stroke hgi-user"></i>
                        </div>
                        <span class="admin-ch-name">{{ p.knownas || p.username }}</span>
                        <code class="admin-ch-path">{{ p.email }}</code>
                        <div class="admin-ch-actions">
                            <button class="admin-icon-btn" @click="approveUser(p.id)" title="승인">
                                <i class="hgi hgi-stroke hgi-tick-01"></i>
                            </button>
                            <button class="admin-icon-btn danger" @click="rejectUser(p.id)" title="거절">
                                <i class="hgi hgi-stroke hgi-delete-02"></i>
                            </button>
                        </div>
                    </div>
                    <div v-if="!pendingUsers.length" class="empty" style="padding:14px 0">승인 대기 중인 가입 신청이 없습니다.</div>
                </div>
                <p v-if="pendingError" class="admin-error">{{ pendingError }}</p>
            </div>

            <!-- 기본 페이지(마을 / 공지 게시판) 맵 편집 -->
            <div class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">기본 페이지</span>
                </div>
                <p class="admin-label-hint" style="margin:-4px 0 10px">
                    사이드바의 "마을"·"공지 게시판"은 고정 링크라 채널 목록에 만들 필요 없이 여기서 이름과 맵을 바로 편집할 수 있어요.
                </p>
                <div v-for="pinned in PINNED_PAGES" :key="pinned.path" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
                    <input
                        v-model="pinnedNameDraft[pinned.path]"
                        :placeholder="pinned.knownas"
                        class="post-input"
                        style="flex:1;min-width:120px"
                    />
                    <button
                        class="admin-add-btn"
                        style="margin-left:0"
                        :disabled="pinnedSaving === pinned.path || !pinnedNameDraft[pinned.path]?.trim()"
                        @click="savePinnedName(pinned)"
                    >
                        {{ pinnedSaving === pinned.path ? '저장 중...' : '이름 저장' }}
                    </button>
                    <button
                        class="admin-add-btn"
                        style="margin-left:0"
                        :disabled="pinnedLoading === pinned.path"
                        @click="openPinnedMapEdit(pinned)"
                    >
                        <i class="hgi hgi-stroke hgi-map-01"></i>
                        {{ pinnedLoading === pinned.path ? '불러오는 중...' : '맵 편집' }}
                    </button>
                </div>
                <p v-if="pinnedError" class="admin-error">{{ pinnedError }}</p>
            </div>

            <!-- 채널 목록 섹션 -->
            <div class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">채널 목록</span>
                    <button class="admin-add-btn" @click="openCreate">
                        <i class="hgi hgi-stroke hgi-add-01"></i> 새 채널
                    </button>
                </div>

                <div class="admin-channel-list">
                    <div
                        v-for="(entry, i) in orderedList"
                        :key="entryKey(entry, i)"
                        class="admin-channel-item"
                        :class="{ 'is-title': isTitleEntry(entry) }"
                    >
                        <!-- 섹션 타이틀 구분자 -->
                        <template v-if="isTitleEntry(entry)">
                            <i class="hgi hgi-stroke hgi-text-font admin-ch-icon" style="opacity:0.4"></i>
                            <span class="admin-ch-name title-entry">{{ entry.knownas }}</span>
                            <span class="admin-ch-type-badge">제목</span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn" @click="moveUp(i)" :disabled="i === 0" title="위로">↑</button>
                                <button class="admin-icon-btn" @click="moveDown(i)" :disabled="i === orderedList.length - 1" title="아래로">↓</button>
                                <button class="admin-icon-btn danger" @click="removeTitleEntry(i)" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </template>

                        <!-- 실제 채널 -->
                        <template v-else>
                            <i :class="channelIcon(entry.type)" class="admin-ch-icon"></i>
                            <span class="admin-ch-name">{{ entry.knownas }}</span>
                            <code class="admin-ch-path">{{ entry.path }}</code>
                            <span class="admin-ch-type-badge">{{ typeLabel(entry.type) }}</span>
                            <span v-if="entry.federated" class="admin-ch-type-badge admin-ch-federated-badge"><i class="hgi hgi-stroke hgi-globe-02"></i> 연합</span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn" @click="moveUp(i)" :disabled="i === 0" title="위로">↑</button>
                                <button class="admin-icon-btn" @click="moveDown(i)" :disabled="i === orderedList.length - 1" title="아래로">↓</button>
                                <button class="admin-icon-btn" @click="openEdit(entry)" title="편집">
                                    <i class="hgi hgi-stroke hgi-edit-02"></i>
                                </button>
                                <button class="admin-icon-btn danger" @click="confirmDelete(entry)" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </template>
                    </div>

                    <div v-if="!orderedList.length" class="empty" style="padding:20px 0">
                        채널이 없습니다. 새 채널을 만들어 보세요.
                    </div>
                </div>

                <!-- 제목 구분자 추가 -->
                <div class="admin-title-add">
                    <input v-model="newTitleName" placeholder="섹션 제목 입력" class="post-input" style="flex:1" />
                    <button class="admin-add-btn" @click="addTitleEntry" :disabled="!newTitleName.trim()">
                        제목 추가
                    </button>
                </div>

                <!-- 순서 저장 -->
                <button class="submit-btn" style="margin-top:12px;align-self:flex-start" @click="saveOrder" :disabled="saving">
                    {{ saving ? '저장 중...' : '순서 저장' }}
                </button>
                <p v-if="saveMsg" class="admin-save-msg">{{ saveMsg }}</p>
            </div>
        </div>

        <!-- 새 채널 만들기 -->
        <div v-else-if="view === 'create'" id="settings-content">
            <div class="create-form">
                <label class="admin-label">채널 이름</label>
                <input v-model="form.knownas" placeholder="예: 자유 게시판" class="post-input" />

                <label class="admin-label">URL 경로 <span class="admin-label-hint">슬래시 포함, 예: /free</span></label>
                <input v-model="form.path" placeholder="/channel-path" class="post-input" />

                <label class="admin-label">채널 유형</label>
                <select v-model="form.type" class="admin-select">
                    <option value="room">💬 채팅방 (room)</option>
                    <option value="board">📋 게시판 (board)</option>
                    <option value="voice">🔊 음성채팅방 (voice)</option>
                    <option value="wiki">📖 위키 (wiki)</option>
                </select>

                <label class="admin-label">채널 소개 <span class="admin-label-hint">선택</span></label>
                <textarea v-model="form.info" placeholder="채널 설명..." class="post-textarea" style="min-height:70px"></textarea>

                <label v-if="form.type === 'board'" class="admin-checkbox-row">
                    <input type="checkbox" v-model="federatedChecked" />
                    <i class="hgi hgi-stroke hgi-globe-02"></i>
                    <span>연합 게시판으로 지정</span>
                    <span class="admin-label-hint">— 서버당 1개만 지정 가능하며, 이 게시판에 작성된 글만 fediverse로 연합됩니다. 다른 연합 게시판이 있다면 자동 해제됩니다.</span>
                </label>

                <p v-if="formError" class="admin-error">{{ formError }}</p>
                <button class="submit-btn" style="align-self:flex-start" @click="submitCreate" :disabled="!form.knownas.trim() || !form.path.trim() || saving">
                    {{ saving ? '생성 중...' : '채널 생성' }}
                </button>
            </div>
        </div>

        <!-- 채널 편집 -->
        <div v-else-if="view === 'edit' && editTarget" id="settings-content">
            <div class="create-form">
                <label class="admin-label">채널 이름</label>
                <input v-model="form.knownas" placeholder="채널 이름" class="post-input" />

                <label class="admin-label">URL 경로 <span class="admin-label-hint">슬래시 포함, 예: /free</span></label>
                <input v-model="form.path" placeholder="/channel-path" class="post-input" />

                <label class="admin-label">채널 유형</label>
                <select v-model="form.type" class="admin-select">
                    <option value="room">💬 채팅방 (room)</option>
                    <option value="board">📋 게시판 (board)</option>
                    <option value="voice">🔊 음성채팅방 (voice)</option>
                    <option value="wiki">📖 위키 (wiki)</option>
                </select>

                <label class="admin-label">채널 소개 <span class="admin-label-hint">선택</span></label>
                <textarea v-model="form.info" placeholder="채널 설명..." class="post-textarea" style="min-height:70px"></textarea>

                <label v-if="form.type === 'board'" class="admin-checkbox-row">
                    <input type="checkbox" v-model="federatedChecked" />
                    <i class="hgi hgi-stroke hgi-globe-02"></i>
                    <span>연합 게시판으로 지정</span>
                    <span class="admin-label-hint">— 서버당 1개만 지정 가능하며, 이 게시판에 작성된 글만 fediverse로 연합됩니다. 다른 연합 게시판이 있다면 자동 해제됩니다.</span>
                </label>

                <p v-if="formError" class="admin-error">{{ formError }}</p>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <button class="submit-btn" style="align-self:flex-start" @click="submitEdit" :disabled="!form.knownas.trim() || !form.path.trim() || saving">
                        {{ saving ? '저장 중...' : '변경사항 저장' }}
                    </button>
                    <button class="admin-add-btn" style="margin-left:0" @click="view = 'map-edit'">
                        <i class="hgi hgi-stroke hgi-map-01"></i> 맵 편집
                    </button>
                </div>
            </div>
        </div>

        <!-- 채널 맵 편집 -->
        <div v-else-if="view === 'map-edit' && editTarget" id="settings-content">
            <WindowMapEditor
                :map-data="editTarget.map ?? null"
                :room-id="editTarget.id"
                @saved="onMapSaved"
                @cancel="closeMapEdit"
            />
        </div>

        <!-- 삭제 확인 모달 -->
        <div v-if="deleteTarget" class="admin-confirm-overlay" @click.self="deleteTarget = null">
            <div class="admin-confirm-box">
                <p class="admin-confirm-msg">
                    <strong>{{ deleteTarget.knownas }}</strong> 채널을 정말 삭제할까요?<br />
                    <span style="font-size:0.82rem;opacity:0.55">채널 내 메시지·게시물은 남아있지만 채널이 목록에서 사라집니다.</span>
                </p>
                <div class="admin-confirm-actions">
                    <button class="back-btn-header" @click="deleteTarget = null">취소</button>
                    <button class="submit-btn danger-btn" @click="doDelete" :disabled="saving">
                        {{ saving ? '삭제 중...' : '삭제' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const slug = config.public.serverSlug
const objectStorageEnabled = config.public.objectStorageEnabled

const emit = defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()

// 서버 + 룸 데이터 로드
const { data: serverData, refresh: refreshServer } = await useAsyncData(
    'settings-server',
    () => $fetch(`${apiBaseUrl}/api/getServerBySlug`, {
        method: 'POST',
        body: { slug },
    }).then(res => (Array.isArray(res) ? res[0] : res) ?? null),
)

// 서버 정보 편집
const serverForm = reactive({ title: '', themecolor: '#D21F3C', info: '', avatar: '', registrationMode: 'open' })
const serverSaving = ref(false)
const serverSaveMsg = ref('')
const serverError = ref('')
const serverIconFileInput = ref(null)
const serverIconUploading = ref(false)

watch(serverData, (data) => {
    if (!data) return
    serverForm.title = data.title ?? ''
    serverForm.themecolor = data.themecolor ?? '#D21F3C'
    serverForm.info = data.info ?? ''
    serverForm.avatar = data.avatar ?? ''
    serverForm.registrationMode = data.registrationMode ?? 'open'
}, { immediate: true })

// 승인 대기 중인 가입 신청
const { data: pendingUsersData, refresh: refreshPendingUsers } = await useAsyncData(
    'pending-users',
    () => $fetch(`${apiBaseUrl}/api/admin/getPendingUsers`, {
        method: 'POST',
        body: { userid: userId.value },
    }).then(res => Array.isArray(res) ? res : []).catch(() => []),
)
const pendingUsers = computed(() => pendingUsersData.value ?? [])
const pendingError = ref('')

async function approveUser(id) {
    pendingError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/approveUser`, {
            method: 'POST',
            body: { userid: userId.value, id },
        })
        await refreshPendingUsers()
    } catch (e) {
        pendingError.value = e?.data?.message ?? '승인에 실패했습니다'
    }
}

async function rejectUser(id) {
    pendingError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/rejectUser`, {
            method: 'POST',
            body: { userid: userId.value, id },
        })
        await refreshPendingUsers()
    } catch (e) {
        pendingError.value = e?.data?.message ?? '거절에 실패했습니다'
    }
}

async function submitServerInfo() {
    serverSaving.value = true
    serverError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/updateServer`, {
            method: 'POST',
            body: { userid: userId.value, slug, ...serverForm },
        })
        await refreshServer()
        await refreshNuxtData('server-data')
        serverSaveMsg.value = '저장되었습니다!'
        setTimeout(() => { serverSaveMsg.value = '' }, 2500)
    } catch (e) {
        serverError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    serverSaving.value = false
}

// 커스텀 이모지 관리
const { list: customEmojiList, ensureLoaded: ensureCustomEmojisLoaded, invalidate: invalidateCustomEmojis } = useCustomEmojis()
const newEmojiShortcode = ref('')
const emojiFileInput = ref(null)
const customEmojiUploading = ref(false)
const customEmojiError = ref('')

async function handleCustomEmojiFile(e) {
    const file = e.target.files?.[0]
    if (!file || !newEmojiShortcode.value.trim()) return
    customEmojiUploading.value = true
    customEmojiError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('shortcode', newEmojiShortcode.value.trim())
        formData.append('file', file)
        await $fetch(`${apiBaseUrl}/api/admin/createCustomEmoji`, {
            method: 'POST',
            body: formData,
        })
        newEmojiShortcode.value = ''
        await invalidateCustomEmojis()
    } catch (err) {
        customEmojiError.value = err?.data?.message ?? '업로드에 실패했습니다'
    }
    customEmojiUploading.value = false
    e.target.value = ''
}

async function deleteCustomEmoji(id) {
    customEmojiError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/deleteCustomEmoji`, {
            method: 'POST',
            body: { userid: userId.value, id },
        })
        await invalidateCustomEmojis()
    } catch (err) {
        customEmojiError.value = err?.data?.message ?? '삭제에 실패했습니다'
    }
}

onMounted(() => {
    ensureCustomEmojisLoaded()
})

async function handleServerIconFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    serverIconUploading.value = true
    serverError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('file', file)
        const result = await $fetch(`${apiBaseUrl}/api/admin/uploadServerIcon`, {
            method: 'POST',
            body: formData,
        })
        serverForm.avatar = result.url
    } catch (e) {
        serverError.value = e?.data?.message ?? '업로드에 실패했습니다'
    }
    serverIconUploading.value = false
    e.target.value = ''
}

const { data: roomsData, refresh: refreshRooms } = await useAsyncData(
    'settings-rooms',
    () => $fetch(`${apiBaseUrl}/api/getRoomsBySlug`, {
        method: 'POST',
        body: { slug },
    }).then(res => Array.isArray(res) ? res : []),
)

// server.rooms 배열 파싱 → 순서대로 채널+제목 목록
const orderedList = ref([])

function buildOrderedList() {
    const rawOrder = serverData.value?.rooms ? JSON.parse(serverData.value.rooms) : []
    const fetched = roomsData.value ?? []
    orderedList.value = rawOrder.map(entry => {
        if (typeof entry === 'number') {
            return fetched.find(r => r.id === entry) ?? null
        }
        return entry  // 제목 구분자 { type: 'title', knownas: '...' }
    }).filter(Boolean)
}

watch([serverData, roomsData], buildOrderedList, { immediate: true })

const view = ref('list')
const saving = ref(false)
const saveMsg = ref('')
const formError = ref('')
const deleteTarget = ref(null)
const editTarget = ref(null)
const newTitleName = ref('')
const federatedChecked = ref(false)

// 사이드바에 하드코딩된 고정 페이지 — 채널 목록(servers.rooms)과 무관하게 경로로 바로 맵 편집
const PINNED_PAGES = [
    { path: '/', knownas: '마을', type: 'room' },
    { path: '/noti', knownas: '공지 게시판', type: 'board' },
]
const pinnedEdit = ref(false)
const pinnedLoading = ref('')
const pinnedError = ref('')

// 고정 페이지의 실제 현재 이름 — roomsData(getRoomsBySlug)에 이미 다 들어있어서 따로 fetch 안 함
function findPinnedRoom(path) {
    return (roomsData.value ?? []).find((r) => r.path === path)
}

const pinnedNameDraft = reactive({})
watch(roomsData, (rooms) => {
    for (const pinned of PINNED_PAGES) {
        if (pinned.path in pinnedNameDraft) continue
        const room = (rooms ?? []).find((r) => r.path === pinned.path)
        pinnedNameDraft[pinned.path] = room?.knownas ?? pinned.knownas
    }
}, { immediate: true })

const pinnedSaving = ref('')

async function savePinnedName(pinned) {
    const newName = pinnedNameDraft[pinned.path]?.trim()
    if (!newName) return
    pinnedError.value = ''
    pinnedSaving.value = pinned.path
    try {
        let room = findPinnedRoom(pinned.path)
        if (!room) {
            room = await $fetch(`${apiBaseUrl}/api/admin/getOrCreateRoomByPath`, {
                method: 'POST',
                body: { userid: userId.value, ...pinned },
            })
        }
        await $fetch(`${apiBaseUrl}/api/admin/updateRoom`, {
            method: 'POST',
            body: { userid: userId.value, id: room.id, path: room.path, knownas: newName, type: room.type, info: room.info },
        })
        await refreshRooms()
        await refreshNuxtData('rooms-data')
    } catch (e) {
        pinnedError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    pinnedSaving.value = ''
}

const form = reactive({ knownas: '', path: '', type: 'room', info: '' })

function isTitleEntry(entry) {
    return entry?.type === 'title'
}

function entryKey(entry, i) {
    return isTitleEntry(entry) ? `title-${i}` : `room-${entry.id}`
}

function channelIcon(type) {
    const map = {
        board: 'hgi hgi-stroke hgi-grid',
        voice: 'hgi hgi-stroke hgi-volume-high',
        wiki: 'hgi hgi-stroke hgi-book-open-01',
    }
    return map[type] ?? 'hgi hgi-stroke hgi-meeting-room'
}

function typeLabel(type) {
    const map = { room: '채팅방', board: '게시판', voice: '음성', wiki: '위키' }
    return map[type] ?? type
}

function moveUp(i) {
    if (i === 0) return
    const arr = [...orderedList.value]
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    orderedList.value = arr
}

function moveDown(i) {
    if (i >= orderedList.value.length - 1) return
    const arr = [...orderedList.value]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    orderedList.value = arr
}

function addTitleEntry() {
    if (!newTitleName.value.trim()) return
    orderedList.value = [...orderedList.value, { type: 'title', knownas: newTitleName.value.trim() }]
    newTitleName.value = ''
}

function removeTitleEntry(i) {
    orderedList.value = orderedList.value.filter((_, idx) => idx !== i)
}

async function refreshAll() {
    await Promise.all([refreshServer(), refreshRooms()])
    await refreshNuxtData('server-data')
    await refreshNuxtData('rooms-data')
    buildOrderedList()
}

// 순서 배열을 서버에 저장
async function saveOrder() {
    saving.value = true
    saveMsg.value = ''
    const roomsList = orderedList.value.map(entry =>
        isTitleEntry(entry) ? entry : entry.id
    )
    await $fetch(`${apiBaseUrl}/api/admin/updateServerRooms`, {
        method: 'POST',
        body: { userid: userId.value, slug, roomsList },
    })
    await refreshAll()
    saving.value = false
    saveMsg.value = '저장되었습니다!'
    setTimeout(() => { saveMsg.value = '' }, 2500)
}

// 채널 생성 폼 열기
function openCreate() {
    pinnedEdit.value = false
    form.knownas = ''
    form.path = ''
    form.type = 'room'
    form.info = ''
    federatedChecked.value = false
    formError.value = ''
    view.value = 'create'
}

async function submitCreate() {
    if (!form.knownas.trim() || !form.path.trim()) return
    saving.value = true
    formError.value = ''
    try {
        const created = await $fetch(`${apiBaseUrl}/api/admin/createRoom`, {
            method: 'POST',
            body: { userid: userId.value, slug, ...form },
        })
        if (form.type === 'board' && federatedChecked.value) {
            await $fetch(`${apiBaseUrl}/api/admin/setFederatedRoom`, {
                method: 'POST',
                body: { userid: userId.value, slug, roomid: created.id, federated: true },
            })
        }
        await refreshAll()
        view.value = 'list'
    } catch (e) {
        formError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    saving.value = false
}

function onMapSaved(mapJson) {
    editTarget.value = { ...editTarget.value, map: mapJson }
    view.value = pinnedEdit.value ? 'list' : 'edit'
}

function closeMapEdit() {
    view.value = pinnedEdit.value ? 'list' : 'edit'
}

// 채널 편집 폼 열기
function openEdit(room) {
    pinnedEdit.value = false
    editTarget.value = room
    form.knownas = room.knownas
    form.path = room.path
    form.type = room.type
    form.info = room.info ?? ''
    federatedChecked.value = !!room.federated
    formError.value = ''
    view.value = 'edit'
}

// 마을/공지 게시판처럼 고정 경로의 room을 찾거나 생성해서 바로 맵 편집으로 이동
async function openPinnedMapEdit(pinned) {
    pinnedError.value = ''
    pinnedLoading.value = pinned.path
    try {
        const room = await $fetch(`${apiBaseUrl}/api/admin/getOrCreateRoomByPath`, {
            method: 'POST',
            body: { userid: userId.value, ...pinned },
        })
        pinnedEdit.value = true
        editTarget.value = room
        view.value = 'map-edit'
    } catch (e) {
        pinnedError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    pinnedLoading.value = ''
}

async function submitEdit() {
    if (!form.knownas.trim() || !form.path.trim()) return
    saving.value = true
    formError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/updateRoom`, {
            method: 'POST',
            body: { userid: userId.value, id: editTarget.value.id, ...form },
        })
        if (form.type === 'board') {
            await $fetch(`${apiBaseUrl}/api/admin/setFederatedRoom`, {
                method: 'POST',
                body: { userid: userId.value, slug, roomid: editTarget.value.id, federated: federatedChecked.value },
            })
        }
        await refreshAll()
        view.value = 'list'
    } catch (e) {
        formError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    saving.value = false
}

// 삭제
function confirmDelete(room) {
    deleteTarget.value = room
}

async function doDelete() {
    if (!deleteTarget.value) return
    saving.value = true
    await $fetch(`${apiBaseUrl}/api/admin/deleteRoom`, {
        method: 'POST',
        body: { userid: userId.value, slug, id: deleteTarget.value.id },
    })
    await refreshAll()
    deleteTarget.value = null
    saving.value = false
}

</script>

<style>
#settings-content {
    padding: 20px 24px;
    font-size: 0.95rem;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.admin-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.admin-section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}

.admin-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(var(--fg-rgb),0.35);
}

.admin-add-btn {
    margin-left: auto;
    background: rgba(var(--fg-rgb),0.12);
    border: 1px solid rgba(var(--fg-rgb),0.2);
    color: rgba(var(--fg-rgb),0.8);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.1s;
}
.admin-add-btn:hover { background: rgba(var(--fg-rgb),0.2); color: rgba(var(--fg-rgb),1); }
.admin-add-btn:disabled { opacity: 0.35; cursor: default; }

/* 채널 목록 */
.admin-channel-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid rgba(var(--fg-rgb),0.07);
    border-radius: 10px;
    padding: 6px;
    background: rgba(0,0,0,0.15);
}

.admin-channel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 7px;
    background: rgba(var(--fg-rgb),0.04);
    transition: background 0.1s;
    min-height: 38px;
}

.admin-channel-item:hover { background: rgba(var(--fg-rgb),0.07); }

.admin-channel-item.is-title {
    background: rgba(var(--fg-rgb),0.02);
    border: 1px dashed rgba(var(--fg-rgb),0.08);
}

.admin-ch-icon {
    font-size: 0.9rem;
    color: rgba(var(--fg-rgb),0.35);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
}

.admin-ch-name {
    font-size: 0.9rem;
    color: rgba(var(--fg-rgb),0.85);
    flex: 1;
    min-width: 0; /* flex:1만으로는 형제 요소들 때문에 줄어들지 않아 행이 넘칠 수 있음(플렉스박스 기본값 이슈) */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.admin-ch-name.title-entry {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(var(--fg-rgb),0.4);
}

.admin-ch-path {
    font-size: 0.74rem;
    color: rgba(var(--fg-rgb),0.3);
    background: rgba(var(--fg-rgb),0.05);
    border-radius: 4px;
    padding: 1px 6px;
    flex-shrink: 0;
    font-family: monospace;
}

.admin-ch-type-badge {
    font-size: 0.7rem;
    color: rgba(var(--fg-rgb),0.4);
    background: rgba(var(--fg-rgb),0.06);
    border-radius: 4px;
    padding: 1px 7px;
    flex-shrink: 0;
}

.admin-ch-actions {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
}

.admin-icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    color: rgba(var(--fg-rgb),0.45);
    border-radius: 5px;
    font-size: 0.88rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
    font-family: inherit;
}

.admin-icon-btn:hover {
    background: rgba(var(--fg-rgb),0.1);
    color: rgba(var(--fg-rgb),1);
}

.admin-icon-btn:disabled {
    opacity: 0.2;
    cursor: default;
}

.admin-icon-btn.danger:hover {
    background: rgba(210,31,60,0.25);
    color: #ff5070;
}

/* 제목 추가 행 */
.admin-title-add {
    display: flex;
    gap: 8px;
    align-items: center;
    padding-top: 4px;
}

.admin-title-add .admin-add-btn {
    margin-left: 0;
    white-space: nowrap;
}

/* 폼 레이블 */
.admin-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(var(--fg-rgb),0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 6px;
    display: block;
}

.admin-label-hint {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: rgba(var(--fg-rgb),0.3);
    font-size: 0.75rem;
}

.admin-select {
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.85);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(var(--fg-rgb),0.4)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
}

.admin-select:focus { outline: none; border-color: var(--accent); }
.admin-select option { background: var(--surface-2); }

.admin-ch-federated-badge {
    color: #7cc4ff;
    background: rgba(124,196,255,0.12);
}

.admin-checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.88rem;
    color: rgba(var(--fg-rgb),0.8);
    margin-top: 4px;
    cursor: pointer;
}

.admin-checkbox-row input[type="checkbox"] {
    width: 15px;
    height: 15px;
    cursor: pointer;
}

.admin-color-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.admin-color-input {
    width: 40px;
    height: 38px;
    padding: 2px;
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    background: rgba(var(--fg-rgb),0.06);
    cursor: pointer;
    flex-shrink: 0;
}

.admin-icon-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.admin-icon-preview {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: rgba(var(--fg-rgb),0.06);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--fg-rgb),0.3);
    flex-shrink: 0;
    overflow: hidden;
}

.admin-icon-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.admin-error {
    color: #ff5070;
    font-size: 0.85rem;
    margin: 0;
}

.admin-save-msg {
    font-size: 0.85rem;
    color: #60e080;
    margin: 0;
}

/* 삭제 확인 오버레이 */
.admin-confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: inherit;
}

.admin-confirm-box {
    background: var(--surface-2);
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 12px;
    padding: 24px 28px;
    max-width: 340px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}

.admin-confirm-msg {
    margin: 0;
    line-height: 1.6;
    color: rgba(var(--fg-rgb),0.85);
    font-size: 0.95rem;
}

.admin-confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.danger-btn {
    background-color: #c0102a !important;
}
.danger-btn:hover { background-color: #a00020 !important; }
</style>
