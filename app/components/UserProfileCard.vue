<template>
    <div v-if="profileCardTarget" class="profile-card-catcher" @click.self="closeProfileCard">
        <div class="profile-card-box" :style="cardStyle">
            <button class="profile-card-close" @click="closeProfileCard">✕</button>
            <NuxtImg v-if="profileCardTarget.avatar" :src="profileCardTarget.avatar" class="profile-card-avatar" />
            <div v-else class="profile-card-avatar profile-card-avatar-empty">
                {{ (profileCardTarget.knownas ?? profileCardTarget.username ?? '?')[0] }}
            </div>
            <div class="profile-card-name">{{ profileCardTarget.knownas ?? profileCardTarget.username }}</div>
            <code class="profile-card-handle">@{{ profileCardTarget.username }}</code>
            <NuxtLink :to="`/@${profileCardTarget.username}`" class="profile-card-goto-btn" @click="closeProfileCard">
                프로필로 이동
            </NuxtLink>
        </div>
    </div>
</template>

<script setup>
const { profileCardTarget, profileCardPos, closeProfileCard } = useProfileCard()

// 클릭한 지점 바로 옆에 카드를 띄우되, 화면 밖으로 삐져나가지 않게 clamp함 — 카드 실제 크기를
// 정확히 알 방법이 없어서(렌더 전이라) 대략적인 예상 크기로 여유 있게 잡아둠
const CARD_W = 240
const CARD_H = 260
const MARGIN = 12
const cardStyle = computed(() => {
    if (!import.meta.client) return {}
    const { x, y } = profileCardPos.value
    let left = x + 14
    let top = y + 14
    if (left + CARD_W > window.innerWidth - MARGIN) left = x - CARD_W - 14
    if (top + CARD_H > window.innerHeight - MARGIN) top = y - CARD_H - 14
    left = Math.min(Math.max(left, MARGIN), window.innerWidth - CARD_W - MARGIN)
    top = Math.min(Math.max(top, MARGIN), window.innerHeight - CARD_H - MARGIN)
    return { left: `${left}px`, top: `${top}px` }
})
</script>

<style>
/* 배경은 클릭 감지용으로만 씀(투명) — 카드 자체는 클릭한 지점 근처에 절대 위치로 따로 띄움 */
.profile-card-catcher {
    position: fixed;
    inset: 0;
    z-index: 20000;
}

.profile-card-box {
    position: fixed;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 24px 26px;
    border-radius: 14px;
    background: var(--surface-1);
    color: rgba(var(--fg-rgb),0.9);
    text-align: center;
    width: 240px;
    box-shadow: var(--modal-shadow, 0 8px 30px rgba(0,0,0,0.35));
}

.profile-card-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: rgba(var(--fg-rgb),0.08);
    color: rgba(var(--fg-rgb),0.6);
    cursor: pointer;
    font-size: 0.85rem;
}
.profile-card-close:hover { background: rgba(var(--fg-rgb),0.15); }

.profile-card-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 4px;
}
.profile-card-avatar-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--fg-rgb),0.1);
    font-size: 1.6rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.5);
}

.profile-card-name {
    font-size: 1.05rem;
    font-weight: 700;
}
.profile-card-handle {
    font-size: 0.8rem;
    opacity: 0.55;
    background: none;
}

.profile-card-goto-btn {
    margin-top: 14px;
    padding: 8px 20px;
    border-radius: 8px;
    background-color: var(--accent);
    color: rgba(var(--accent-fg-rgb),1);
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
}
</style>
