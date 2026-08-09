<template>
    <div v-if="profileCardTarget" class="profile-card-overlay" @click.self="closeProfileCard">
        <div class="profile-card-box">
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
const { profileCardTarget, closeProfileCard } = useProfileCard()
</script>

<style>
.profile-card-overlay {
    position: fixed;
    inset: 0;
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.45);
}

.profile-card-box {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 28px 32px;
    border-radius: 14px;
    background: var(--surface-1);
    color: rgba(var(--fg-rgb),0.9);
    text-align: center;
    min-width: 220px;
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
