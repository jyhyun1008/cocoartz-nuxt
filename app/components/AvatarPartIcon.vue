<template>
    <div class="avatar-part-icon" :style="wrapperStyle">
        <!-- 뒷머리 — hair 아이템일 때만, 몸(body)보다도 더 뒤에 한 번 더 겹침. 같은 파일의 시트
             마지막 줄(뒷모습 프레임, row 3)을 크롭해서 씀 — 실제 맵 렌더링(CharacterMoving.vue/
             OtherCharacter.vue)과 같은 이유(긴 머리가 몸에 안 가려지고 뒤로 흘러나온 것처럼 보이게)를
             상점/인벤토리 미리보기에도 그대로 반영 -->
        <img v-if="part === 'hair'" :src="targetSrc" class="avatar-part-icon-layer" :style="backHairLayerStyle" />
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
// 치수라 정사각형 크롭 공식을 그대로 못 씀. 머리 위 여유 공간(DECO_HEADROOM) 전체를 다 보여주면
// 정사각형 박스 안에서 양옆 레터박스가 너무 커 보여서(256/356 비율), 여유 공간 중 일부만
// 보여주는 쪽으로 더 바짝 크롭함 — DECO_ICON_VISIBLE_HEADROOM 참고
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

// 데코 아이콘에서 실제로 보여줄 머리 위 여유 공간 — 전체(100px)를 다 보여주면 정사각형 박스 안에서
// 폭 대비 너무 홀쭉해 보여서(가로 256 : 세로 356), 일부만 보여주는 걸로 타협함. 이 값을 늘리면
// 키 큰 데코가 더 잘 보이는 대신 레터박스(양옆 여백)가 커지고, 줄이면 레터박스는 줄지만 여유
// 공간 위쪽은 크롭돼서 안 보임
const DECO_ICON_VISIBLE_HEADROOM = 30
const DECO_ICON_CROP_H = CELL + DECO_ICON_VISIBLE_HEADROOM // 286

// 데코는 위 크롭 높이 기준으로 축소해서 정사각형 박스 안에 들어오게 함(가로는 남는 만큼만
// 레터박스). 나머지 파츠는 원래처럼 정사각형 셀(256) 기준
const scale = computed(() => props.size / (isDeco.value ? DECO_ICON_CROP_H : CELL))

const wrapperStyle = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
}))

// col=1이라 왼쪽으로 한 칸만큼. 데코는 셀 폭(256)이 크롭 높이(286)보다 좁아서 축소 후 폭이
// 박스보다 작아지므로 남는 폭만큼 가운데 정렬해줌(centerOffset). row=0 크롭 구간의 위쪽
// (여유 공간 중 안 보여주기로 한 만큼, DECO_HEADROOM - DECO_ICON_VISIBLE_HEADROOM)은 잘라내고
// "발 위치" 기준선(크롭 구간 아래쪽)은 그대로 유지함
const targetLayerStyle = computed(() => {
    if (isDeco.value) {
        const cellW = DECO_CELL_W * scale.value
        const centerOffset = (props.size - cellW) / 2
        const hiddenHeadroom = DECO_HEADROOM - DECO_ICON_VISIBLE_HEADROOM
        return {
            top: `-${hiddenHeadroom * scale.value}px`,
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

// 뒷머리 미리보기 크롭 — targetLayerStyle과 같은 셀(col=1)이지만 row만 3(시트 마지막 줄,
// 뒷모습 프레임)으로 고정. hair는 deco가 아니므로 scale은 항상 CELL 기준(= props.size/CELL)
const backHairLayerStyle = computed(() => ({
    top: `-${3 * props.size}px`,
    left: `-${props.size}px`,
    width: `${SPRITE_W * scale.value}px`,
    height: `${SPRITE_H * scale.value}px`,
}))

// 데코 뒤에 겹쳐 보여주는 기본 바디 레이어 — 데코와 같은 scale을 쓰다 보니 바디의 셀 폭(256)도
// 정사각형 파츠 때와 다른 비율로 축소되므로, targetLayerStyle의 데코와 똑같은 방식으로 가운데
// 정렬을 다시 계산함. "발 위치" 기준선이 데코와 같아지도록 데코가 보여주는 여유 공간
// (DECO_ICON_VISIBLE_HEADROOM)만큼만 아래로 내려서 정렬함(전체 DECO_HEADROOM이 아님 — 크롭에서
// 잘려나간 만큼은 바디도 똑같이 화면 밖으로 밀려나야 기준선이 맞음)
const bodyLayerStyle = computed(() => {
    if (!isDeco.value) return targetLayerStyle.value
    const cellW = CELL * scale.value
    const centerOffset = (props.size - cellW) / 2
    return {
        top: `${DECO_ICON_VISIBLE_HEADROOM * scale.value}px`,
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
