<template>
    <div id="infowindow-wrapper">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-information-square"></i>
            <span>서버 정보</span>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>
        <div id="info-wrapper">
            <p class="info-placeholder">서버에 대한 정보가 여기에 표시됩니다.</p>
        </div>
    </div>
</template>

<script setup>
defineEmits(['close'])
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
    background-color: #1a1a22f0;
    backdrop-filter: blur(4px);
    color: rgba(255,255,255,0.85);
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
    color: rgba(255,255,255,0.3);
    margin: 0;
}

@media (max-width: 768px) {
    #infowindow-wrapper {
        width: calc(100% - 24px);
    }
}
</style>
