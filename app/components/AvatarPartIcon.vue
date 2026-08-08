<template>
    <div class="avatar-part-icon" :style="wrapperStyle">
        <!-- body 파트 자체를 보여줄 땐 바디 한 장만, 나머지 파츠는 기본 바디 위에 그 파츠를 겹쳐서
             "실제로 착용했을 때" 느낌으로 보여줌(파츠 혼자면 허공에 뜬 조각처럼 보여서 뭔지 알아보기 어려움) -->
        <img v-if="part !== 'body'" src="/character/body/1.png" class="avatar-part-icon-layer" :style="layerStyle" />
        <img :src="`/character/${part}/${variant}.png`" class="avatar-part-icon-layer" :style="layerStyle" />
    </div>
</template>

<script setup>
// 캐릭터 파츠 원본 PNG(768x1024, 정면·측면·후면 3열×4행 프레임시트)에서 정면 대기 프레임만
// CSS로 크롭해서 보여줌 — CharacterMoving.vue의 기본 프레임(row:0, col:1)과 정확히 같은 셀.
// 서버에서 미리 잘라둔 별도 아이콘 파일이 필요 없어서, 새 variant를 추가해도 아이콘이 자동으로 생김.
const props = defineProps({
    part: { type: String, required: true }, // 'hair' | 'top' | 'bottom' | 'shoes' | 'face' | 'body'
    variant: { type: [String, Number], required: true },
    size: { type: Number, default: 56 },
})

const SPRITE_W = 768
const SPRITE_H = 1024
const CELL = 256 // 정면(row0) 대기(col1) 프레임 — 한 칸이 256x256

const scale = computed(() => props.size / CELL)

const wrapperStyle = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
}))

// col=1이라 왼쪽으로 한 칸(256px 원본 기준)만큼, row=0이라 위쪽은 그대로 — 스케일된 크기 그대로가
// 곧 이동량(256 * scale = size)이라 별도 계산 없이 -size로 씀
const layerStyle = computed(() => ({
    top: '0px',
    left: `-${props.size}px`,
    width: `${SPRITE_W * scale.value}px`,
    height: `${SPRITE_H * scale.value}px`,
}))
</script>

<style>
.avatar-part-icon {
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
}

.avatar-part-icon-layer {
    position: absolute;
    display: block;
}
</style>
