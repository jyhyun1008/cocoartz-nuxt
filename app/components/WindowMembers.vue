<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-user-group"></i>
            <span>멤버</span>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>
        <div id="members-content">
            <p class="info-placeholder">멤버 목록이 여기에 표시됩니다.</p>
        </div>
    </div>
</template>

<script setup>
defineEmits(['close'])

</script>

<style>
#members-content {
    padding: 24px;
    font-size: 1rem;
    overflow-y: auto;
    flex-grow: 1;
}
</style>
