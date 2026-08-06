<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-user-group"></i>
            <span style="flex:1">멤버 {{ members.length ? `(${members.length})` : '' }}</span>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>
        <div id="members-content">
            <div v-if="members.length" class="member-list">
                <NuxtLink
                    v-for="m in members"
                    :key="m.id"
                    :to="m.username ? `/@${m.username}` : '#'"
                    class="member-item"
                >
                    <div class="member-avatar">
                        <img v-if="m.avatar" :src="m.avatar" />
                        <span v-else>{{ (m.knownas || m.username || '?')[0] }}</span>
                    </div>
                    <div class="member-info">
                        <div class="member-name">
                            {{ m.knownas || m.username }}
                            <span v-if="m.isAdmin" class="member-admin-badge">관리자</span>
                        </div>
                        <div class="member-handle">@{{ m.username }}</div>
                    </div>
                    <div class="member-joined">{{ formatDateOnly(m.createdAt) }} 가입</div>
                </NuxtLink>
            </div>
            <p v-else class="info-placeholder">아직 멤버가 없습니다.</p>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
defineEmits(['close'])

const { data: membersData } = await useAsyncData(
    'members-list',
    () => $fetch(`${apiBaseUrl}/api/getMembers`, { method: 'POST' }).then(res => Array.isArray(res) ? res : []),
)

const members = computed(() => membersData.value ?? [])
</script>

<style>
#members-content {
    padding: 20px 24px;
    font-size: 1rem;
    overflow-y: auto;
    flex-grow: 1;
}

.info-placeholder {
    color: rgba(var(--fg-rgb),0.3);
    margin: 0;
}

.member-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.member-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: background 0.1s;
}
.member-item:hover { background: rgba(var(--fg-rgb),0.05); }

.member-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bgaccent, #D21F3C22);
    color: var(--accent, #D21F3C);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
}
.member-avatar img { width: 100%; height: 100%; object-fit: cover; }

.member-info { min-width: 0; flex: 1; }

.member-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.9);
    display: flex;
    align-items: center;
    gap: 6px;
}

.member-admin-badge {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--accent);
    background: var(--bgaccent);
    border-radius: 4px;
    padding: 1px 6px;
}

.member-handle {
    font-size: 0.8rem;
    color: rgba(var(--fg-rgb),0.4);
}

.member-joined {
    font-size: 0.75rem;
    color: rgba(var(--fg-rgb),0.3);
    flex-shrink: 0;
}

@media (max-width: 768px) {
    .member-joined { display: none; }
}
</style>
