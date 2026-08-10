<template>
    <div class="avatar-part-icon" :style="wrapperStyle">
        <!-- body 파트 자체를 보여줄 땐 바디 한 장만, 나머지 파츠는 기본 바디 위에 그 파츠를 겹쳐서
             "실제로 착용했을 때" 느낌으로 보여줌(파츠 혼자면 허공에 뜬 조각처럼 보여서 뭔지 알아보기 어려움) -->
        <img v-if="part !== 'body'" :src="getAvatarPartImage('body', 1)" class="avatar-part-icon-layer" :style="bodyLayerStyle" />
        <img :src="targetSrc" class="avatar-part-icon-layer" :style="targetLayerStyle" />
    </div>
</template>

<script setup>
import { DECO_SPRITE_W, DECO_SPRITE_H, DECO_CELL_W, DECO_CELL_H, DECO_HEADROOM } from '../../lib/shopCategories'

// 캐릭터 파츠 원본 PNG(768x1024, 정면·측면·후면 3열×4행 프레임시트)에서 정면 대기 프레임만
// CSS로 크롭해서 보여줌 — CharacterMoving.vue의 기본 프레임(row:0, col:1)과 정확히 같은 셀.
// 원본 이미지는 관리자가 상점 페이지에서 올린 것(useAvatarPartCatalog.ts)이 있으면 그걸, 없으면
// `/character/{part}/{variant}.png` 관례 경로를 씀 — 어느 쪽이든 서버에서 미리 잘라둔 별도
// 아이콘 파일이 필요 없어서, 새 variant를 추가해도 아이콘이 자동으로 생김.
//
// 데코(part==='deco')는 원본이 다른 파츠보다 세로로 100px 더 큰(768x1424, 셀 256x356) 별도
// 치수라 정사각형 크롭 공식을 그대로 못 씀 — 상점/인벤토리 그리드가 전부 정사각형 아이콘
// 박스를 전제하고 있어서, 박스 자체를 키우는 대신 세로 기준으로 축소(contain)해서 정사각형
// 안에 여백(레터박스)과 함께 전체 프레임(머리 위 여유 공간 포함)이 다 보이게 함
const props = defineProps({
    part: { type: String, required: true }, // 'hair' | 'top' | 'bottom' | 'shoes' | 'face' | 'body' | 'outfit' | 'deco'
    variant: { type: [String, Number], required: true },
    size: { type: Number, default: 56 },
    // 관리자 페이지에서 "아직 저장 안 한(=카탈로그에 없는) 새 아이템"을 업로드 직후 미리보기로
    // 보여줄 때만 씀 — 있으면 카탈로그/관례 경로 조회 없이 이 URL을 그대로 씀
    srcOverride: { type: String, default: '' },
})

const { getAvatarPartImage } = useAvatarPartCatalog()
const targetSrc = computed(() => props.srcOverride || getAvatarPartImage(props.part, props.variant))

const SPRITE_W = 768
const SPRITE_H = 1024
const CELL = 256 // 정면(row0) 대기(col1) 프레임 — 한 칸이 256x256

const isDeco = computed(() => props.part === 'deco')

// 데코는 셀 높이(356) 기준으로 축소해서 정사각형 박스 안에 전체 프레임이 들어오게 함(가로는
// 남는 만큼 레터박스). 나머지 파츠는 원래처럼 정사각형 셀(256) 기준
const scale = computed(() => props.size / (isDeco.value ? DECO_CELL_H : CELL))

const wrapperStyle = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
}))

// col=1이라 왼쪽으로 한 칸만큼, row=0이라 위쪽은 그대로. 데코는 셀 폭(256)이 셀 높이(356)보다
// 좁아서 축소 후 폭이 박스보다 작아지므로 남는 폭만큼 가운데 정렬해줌(centerOffset)
const targetLayerStyle = computed(() => {
    if (isDeco.value) {
        const cellW = DECO_CELL_W * scale.value
        const centerOffset = (props.size - cellW) / 2
        return {
            top: '0px',
            left: `${centerOffset - cellW}px`,
            width: `${DECO_SPRITE_W * scale.value}px`,
            height: `${DECO_SPRITE_H * scale.value}px`,
        }
    }
    // 스케일된 크기 그대로가 곧 이동량(256 * scale = size)이라 별도 계산 없이 -size로 씀
    return {
        top: '0px',
        left: `-${props.size}px`,
        width: `${SPRITE_W * scale.value}px`,
        height: `${SPRITE_H * scale.value}px`,
    }
})

// 데코 뒤에 겹쳐 보여주는 기본 바디 레이어 — 데코와 같은 scale(셀 높이 356 기준)을 쓰다 보니
// 바디의 셀 폭(256)도 정사각형 파츠 때와 다른 비율로 축소되므로, targetLayerStyle의 데코와
// 똑같은 방식으로 가운데 정렬을 다시 계산함. "발 위치" 기준선이 데코와 같아지도록 데코 프레임의
// 여유 공간(DECO_HEADROOM)만큼 아래로 내려서 정렬함
const bodyLayerStyle = computed(() => {
    if (!isDeco.value) return targetLayerStyle.value
    const cellW = CELL * scale.value
    const centerOffset = (props.size - cellW) / 2
    return {
        top: `${DECO_HEADROOM * scale.value}px`,
        left: `${centerOffset - cellW}px`,
        width: `${SPRITE_W * scale.value}px`,
        height: `${SPRITE_H * scale.value}px`,
    }
})
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
