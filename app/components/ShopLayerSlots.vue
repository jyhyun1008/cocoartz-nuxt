<!-- 맵 아이템/작물의 레이어 6장을 한 번에 다 골라야 했던 예전 방식 대신, 1~6번 칸을 하나씩
     클릭해서 그 칸만 업로드/교체하는 UI(스프라이트 스태킹 시뮬레이터 아티팩트와 같은 구성) —
     modelValue는 "이번에 새로 올린" 슬롯만 URL이 들어있고 나머지는 null(수정 모드에서 안 바꾼
     칸은 서버가 기존 값을 그대로 유지함). existingLayers는 수정 모드일 때 미리보기용 기존 값. -->
<template>
    <div class="layer-slots-grid">
        <label
            v-for="i in 6" :key="i"
            class="layer-slot"
            :class="{ 'has-image': previewFor(i - 1), 'is-uploading': uploadingIndex === i - 1, 'is-disabled': disabled }"
        >
            <span class="layer-slot-num">{{ i }}</span>
            <button
                v-if="previewFor(i - 1) && !disabled"
                type="button" class="layer-slot-remove"
                :aria-label="`${i}번 레이어 지우기`"
                @click.prevent.stop="clearSlot(i - 1)"
            >✕</button>
            <NuxtImg v-if="previewFor(i - 1)" :src="previewFor(i - 1)" class="layer-slot-img" />
            <span v-else class="layer-slot-hint">{{ i === 1 ? '맨 위' : i === 6 ? '맨 아래' : `${i}번` }}</span>
            <span v-if="uploadingIndex === i - 1" class="layer-slot-uploading">업로드 중...</span>
            <input
                type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                style="display:none" :disabled="disabled"
                @change="(e) => handleFile(i - 1, e)"
            />
        </label>
    </div>
</template>

<script setup>
const props = defineProps({
    modelValue: { type: Array, default: () => new Array(6).fill(null) },
    existingLayers: { type: Array, default: () => new Array(6).fill(null) },
    disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'error'])

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()

const uploadingIndex = ref(null)

function previewFor(idx) {
    return props.modelValue?.[idx] || props.existingLayers?.[idx] || ''
}

async function handleFile(idx, e) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadingIndex.value = idx
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('file', file)
        const result = await $fetch(`${apiBaseUrl}/api/admin/uploadMapItemLayer`, { method: 'POST', body: formData })
        const next = [...(props.modelValue ?? new Array(6).fill(null))]
        next[idx] = result.url
        emit('update:modelValue', next)
    } catch (err) {
        emit('error', err?.data?.message ?? '업로드에 실패했습니다')
    }
    uploadingIndex.value = null
    e.target.value = ''
}

function clearSlot(idx) {
    const next = [...(props.modelValue ?? new Array(6).fill(null))]
    next[idx] = null
    emit('update:modelValue', next)
}
</script>

<style>
.layer-slots-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    max-width: 280px;
}

.layer-slot {
    position: relative;
    aspect-ratio: 1;
    border: 1.5px dashed rgba(var(--fg-rgb),0.15);
    border-radius: 8px;
    background: rgba(var(--fg-rgb),0.03);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.12s, background 0.12s;
}
.layer-slot:hover { border-color: var(--accent); }
.layer-slot.has-image { border-style: solid; }
.layer-slot.is-disabled { cursor: default; opacity: 0.5; pointer-events: none; }

.layer-slot-num {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: 0.62rem;
    font-weight: 800;
    color: var(--accent);
    background: var(--surface-1);
    border-radius: 4px;
    padding: 0 4px;
    z-index: 2;
}

.layer-slot-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.layer-slot-hint {
    font-size: 0.62rem;
    color: rgba(var(--fg-rgb),0.35);
    text-align: center;
    padding: 0 4px;
}

.layer-slot-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    z-index: 3;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: rgba(20,12,8,0.6);
    color: #fff;
    font-size: 0.6rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.layer-slot-uploading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    text-align: center;
    background: rgba(20,12,8,0.55);
    color: #fff;
}
</style>
