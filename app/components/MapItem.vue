<template>
    <div class="map-item-wrapper" :style="wrapperStyle">
        <div class="map-item-stack">
            <!-- 그림자 트레일: 레이어 이미지를 그대로(블러 없이) 복제해서 조금씩 더 아래로 내리면서
                 여러 겹 쌓음 — SVG feGaussianBlur로 진짜 블러를 줘봤는데, 줌으로 크기가 계속 바뀌는
                 동안 크로미움이 필터를 놓쳐서 블러 없는 크리스피한 상태로 멈춰버리는 버그가 간헐적으로
                 있었음(필터 정의를 고정값으로 바꿔도 마찬가지였음 — SVG url() 필터 자체가 이런 조합에
                 약한 걸로 보임). 그래서 블러는 포기하고, 겹마다 조금씩 더 내리고 불투명도를 낮춰서
                 계단식으로 흐릿해 보이게 하는 걸로 바꿈 — 실제 레이어들보다 먼저(=뒤에) 그려서
                 크리스피한 본체를 안 가림 -->
            <template v-if="props.shadowTrail">
                <template v-for="(src, i) in props.layers" :key="`echo-group-${src}`">
                    <NuxtImg
                        v-for="e in shadowEchoCount"
                        :key="`echo-${src}-${e}`"
                        :src="src"
                        class="map-item-layer map-item-echo"
                        :style="echoStyle(i, e)"
                    />
                </template>
            </template>
            <NuxtImg
                v-for="(src, i) in props.layers"
                :key="src"
                :src="src"
                class="map-item-layer"
                :style="layerStyle(i)"
            />
        </div>
    </div>
</template>

<script setup>
// 스프라이트 스태킹 아이템 렌더러
//
// 원리: layers[0]("1.png", 맨 위)부터 layers[last]("6.png", 맨 아래)까지
// 이미 각 프레임 픽셀 안에 레이어별 세로 오프셋이 구워져(baked) 있는 스프라이트 스택 방식.
// 그래서 프레임들을 완전히 같은 위치에 겹쳐 놓기만 해도 baked-in 비율로는 올바른 입체 모양이 나옴.
//
// 페인트 순서(z-index): 6.png(맨 아래)가 제일 밑에 깔리고, 1.png(맨 위)가 제일 위에 그려짐
// → z-index를 layers.length - i 로 줘서 배열 앞쪽(1.png)일수록 z-index가 높아지게 함.
// 즉 1.png가 스택에서 가장 도드라져 보이고, 6.png는 다른 레이어들에 가려지는 밑바닥이 됨.
//
// 줌에 따라 두 가지를 "따로" 조절함 — squashRatio(레이어 자체 세로 배율)와 gapRatio(레이어 사이
// 추가 간격)를 각각 topRatio의 "직선 하나"(줌인 최대 ↔ 줌아웃 최대, 2점만 사용)로 보간함.
// 이 두 점은 튜닝 도구로 직접 눈으로 맞춰서 받은 값:
//   "줌인(정면에 가까워짐)하면 레이어 자체는 납작해지지만 층 사이 간격은 오히려 벌어지고,
//    줌아웃(위에서 보는 것에 가까워짐)하면 레이어 자체는 길쭉해지지만 간격은 줄어든다"
// (처음엔 반대로 생각했었음: 스택 전체를 하나의 배율로 압축하면 될 줄 알았는데, 실제로는
//  레이어 자체 눌림과 레이어 간격이 서로 반대 방향으로 움직여야 원하는 모양이 나왔음)
//
// baseTopRatio(중간) 지점은 3번째 기준점으로 따로 넣지 않음 — 꺾은선으로 만들면 baseTopRatio를
// 지날 때 기울기가 갑자기 바뀌면서(특히 gap의 부호가 바뀌는 지점이라 기울기 차이가 큼) 줌하는
// 도중 살짝 훅 꺼지는 느낌이 있었음. 그래서 두 극단만 직선으로 잇고, baseTopRatio 지점 값은
// 검증용으로만 확인함 — 이 직선 위에서 계산해보면 squash≈99.6%, gap≈1.34px로 실측치(98%, 1.5px)와
// 충분히 가까워서 검증 통과.
//
// 레이어 i의 렌더 높이 = stackBaseHeight * squashRatio (모든 레이어 동일하게 적용, 즉 이미지끼리는
// 서로 비율이 항상 같음 — "찌그러지는 정도"는 줌에 따라 바뀌지만 레이어 사이에서는 균일함).
// 레이어 i의 추가 이동(위로) = (layers.length-1-i) × gapPerLayer, 맨 아래 레이어는 0(발밑 고정).
//
// transform-origin 없이 top:0 + translateY만 쓰기 때문에, 맨 아래 레이어(발밑)가 항상 wrapper
// 맨 위(0px)에 고정되고 나머지 레이어가 그 위로 쌓이는 구조 — wrapper의 top 자체를
// "발밑 접점이 타일 앞모서리에 오도록" 계산해서 앵커링함.
//
// groundRatio: 캔버스(spriteHeight) 안에서 "실제로 땅에 닿는 지점"이 위에서부터 몇 %인지.
// 기본 1(캔버스 맨 아래) — 살짝 뜬 느낌이 의도한 모습이라 보정 안 함(확인받음).
const props = defineProps({
    // 위→아래 순서의 레이어 이미지 경로 (예: ['/item/test/1.png', ..., '/item/test/6.png'])
    layers: { type: Array, required: true },
    // 아이템이 놓인 타일 좌표 (RoomMap의 tile.position과 동일한 체계)
    position: { type: Object, default: () => ({ x: 0, y: 0, z: 0 }) },
    // RoomMap에서 내려오는 현재 topRatio (줌에 따라 0.333~0.9 사이로 변함)
    topRatio: { type: Number, required: true },
    // 기준점(줌인 최대, 정면뷰에 가장 가까움)의 topRatio. 기본 1/3 (zoomLevel=2.5의 topRatio)
    zoomedInTopRatio: { type: Number, default: 1 / 3 },
    // zoomedInTopRatio 시점의 레이어 자체 세로 배율(0~1이면 납작해짐). 튜너로 눈으로 맞춘 값
    squashAtZoomedIn: { type: Number, default: 0.67 },
    // zoomedInTopRatio 시점의 레이어당 추가 간격 — stackBaseHeight 대비 비율(해상도 무관하게 하기 위함)
    // 기본값은 튜너에서 나온 5px ÷ (128×256/230 ≈ 142.6px)
    gapRatioAtZoomedIn: { type: Number, default: 5 / (128 * 256 / 230) },
    // 기준점(줌아웃 최대, 위에서 보는 것에 가장 가까움)의 topRatio. 기본 0.584 (zoomLevel=0.7의 topRatio)
    zoomedOutTopRatio: { type: Number, default: 0.584 },
    // zoomedOutTopRatio 시점의 레이어 자체 세로 배율(1보다 크면 길쭉해짐). 튜너로 눈으로 맞춘 값
    squashAtZoomedOut: { type: Number, default: 1.16 },
    // zoomedOutTopRatio 시점의 레이어당 추가 간격 — stackBaseHeight 대비 비율. 튜너 값 -0.5px ÷ 142.6
    gapRatioAtZoomedOut: { type: Number, default: -0.5 / (128 * 256 / 230) },
    // 프레임 원본(캔버스) 픽셀 크기 — 레이어 이미지들은 전부 같은 캔버스 크기를 가정
    spriteWidth: { type: Number, default: 230 },
    spriteHeight: { type: Number, default: 256 },
    // 타일 위에 렌더될 가로폭(px, zoom=1 기준 — 상위 .maptiles1의 scale(zoomLevel)이 같이 곱해짐)
    // 기본값 128 = TILE_W. 아이템 발판(가장 넓은 지점)이 타일 한 칸 폭과 맞도록 함
    displayWidth: { type: Number, default: 128 },
    // 깊이 정렬용 z-index. 지정 안 하면 타일과 같은 스케일로 자동 계산
    zIndex: { type: Number, default: null },
    // 캔버스 높이(spriteHeight) 중 실제 바닥 접점의 위치 비율(0~1, 위에서부터). 기본 1 = 캔버스 맨 아래
    groundRatio: { type: Number, default: 1 },
    // 레이어 사이 추가 간격에 곱해지는 배율 — 아이템별로 "몇 층 높이짜리"인지 조절할 때 사용(기본 1)
    heightLevels: { type: Number, default: 1 },
    // 각 레이어 아래로 그림자처럼 늘어지는 효과. false면 안 그림
    shadowTrail: { type: Boolean, default: true },
    // 제일 가까운(첫 번째) 복제본의 불투명도(0~1). 뒤로 갈수록 이 값에서 점점 옅어짐
    shadowOpacity: { type: Number, default: 1 },
    // 복제본 사이 간격 — layerHeight 대비 비율. 몇 겹을 아래로 쌓을수록 그만큼 더 내려가며 계단식으로 흐려짐
    shadowStepRatio: { type: Number, default: 0.025 },
    // 겹쳐 쌓을 복제본 개수
    shadowEchoCount: { type: Number, default: 4 },
    // 피사계심도(초점 흐림) — RoomMap의 타일이 쓰는 것과 동일한 px 값을 그대로 받아서 스택 전체에
    // 한 번에 적용(레이어마다 따로 안 걸고 wrapper 하나에만 걸어서 성능/일관성 둘 다 챙김)
    blurPx: { type: Number, default: 0 },
})

const TILE_W = 128

const dynH = computed(() => props.topRatio * 128)
const S = computed(() => (1 - props.topRatio) * 128)
// 타일 앞모서리(발밑) 기준 높이차 — getTileContainerStyle의 sideH와 동일한 식. z 한 칸 = sideH
const sideH = computed(() => dynH.value * 3 / 4 + S.value / 2)

// 스택 박스의 "기준(base) 크기" — squashRatio=1일 때 각 레이어가 렌더되는 크기
const stackBaseHeight = computed(() => props.displayWidth * props.spriteHeight / props.spriteWidth)

const screenX = computed(() => (props.position.x - props.position.y) * (TILE_W / 2))
const screenY = computed(() => (props.position.x + props.position.y) * (dynH.value / 2) - (props.position.z ?? 0) * sideH.value)

// 타일의 "앞쪽 꼭짓점"(top face 하단 중앙, 캐릭터 발밑과 같은 기준점) = screenY + dynH/2
const anchorY = computed(() => screenY.value + dynH.value / 2)

// z-index = 4n + k (n = 화면상 깊이 슬롯, k = 그 슬롯 안에서의 높이 순번 0~3).
// n = x+y+2z — 타일 쪽(RoomMap.vue getTileContainerStyle)과 완전히 같은 식이라, 화면상
// 같은 높이(같은 n)에 있는 타일/아이템끼리는 실제로 z-index가 겹치거나 나란히 비교됨.
// 아이템은 자기가 놓인 층(z)의 바닥 타일(k=z)보다 한 칸 위(k=z+1)에 그려져야 그 바닥 위에
// "서 있는" 것처럼 보임 — 0층 위 아이템은 k=1, 1층 위 아이템은 k=2, 2층 위 아이템은 k=3.
const defaultZIndex = computed(() => {
    const z = props.position.z ?? 0
    const n = props.position.x + props.position.y + 2 * z
    const k = z + 1
    return 4 * n + k
})

// 줌인 최대 ↔ 줌아웃 최대, 두 점을 잇는 직선 하나로 쭉 보간(꺾은선 아님).
// baseTopRatio 지점 값은 이 직선 위에서 "검증용"으로만 확인함(강제로 고정 안 함) — 3점을
// 꺾은선으로 억지로 이었더니 baseTopRatio를 지날 때 기울기가 갑자기 확 바뀌면서(특히 gap
// 쪽이 양→음으로 넘어가는 지점이라 기울기 차이가 커서) 줌하는 도중 살짝 훅 꺼지는 느낌이 있었음.
// 직선 하나로 펴니 baseTopRatio에서의 값도 계산해보면 squash≈99.6%, gap≈1.34px로 실측치
// (98%, 1.5px)랑 충분히 가까워서 검증도 통과함.
function lerp2(topRatioA, valueA, topRatioB, valueB) {
    const span = topRatioB - topRatioA
    if (span === 0) return valueA
    const t = (props.topRatio - topRatioA) / span
    return valueA + (valueB - valueA) * t
}

// 레이어 자체 세로 배율 — 줌인 최대에서 squashAtZoomedIn, 줌아웃 최대에서 squashAtZoomedOut
const squashRatio = computed(() =>
    lerp2(props.zoomedInTopRatio, props.squashAtZoomedIn, props.zoomedOutTopRatio, props.squashAtZoomedOut))

// 레이어당 추가 간격 비율 — 줌인 최대에서 gapRatioAtZoomedIn, 줌아웃 최대에서 gapRatioAtZoomedOut
const gapRatio = computed(() =>
    lerp2(props.zoomedInTopRatio, props.gapRatioAtZoomedIn, props.zoomedOutTopRatio, props.gapRatioAtZoomedOut))

// 실제 렌더 높이(squash 적용됨)와 레이어당 추가 간격(px)
const layerHeight = computed(() => stackBaseHeight.value * squashRatio.value)
const gapPerLayer = computed(() => gapRatio.value * stackBaseHeight.value * props.heightLevels)

// 박스 안에서 바닥 접점까지의 거리(squash 적용된 레이어 기준) — wrapper top을 여기 맞춰 뺌.
// 맨 아래 레이어는 추가 이동이 0이라 항상 wrapper 맨 위(0px)에서 시작하므로 이 식이 그대로 성립
const groundLocalY = computed(() => layerHeight.value * props.groundRatio)

const wrapperStyle = computed(() => ({
    left: `calc(50% + ${screenX.value - props.displayWidth / 2}px)`,
    top: `calc(50% + ${anchorY.value - groundLocalY.value}px)`,
    width: `${props.displayWidth}px`,
    height: `${layerHeight.value}px`,
    zIndex: props.zIndex ?? defaultZIndex.value,
    filter: props.blurPx > 0 ? `blur(${props.blurPx}px)` : undefined,
}))

// 레이어 i의 (그림자 없는) 기본 이동량 — 맨 아래 레이어(마지막 인덱스)는 0, 위로 갈수록 한 단씩 더 밀림
function baseShiftFor(i) {
    const stepsFromGround = props.layers.length - 1 - i
    return stepsFromGround * gapPerLayer.value
}

// 레이어 i의 추가 이동(위로): 모든 레이어는 항상 같은 layerHeight로 렌더돼서 이미지 자체 비율은
// 서로 동일하게 유지됨.
// z-index: 레이어 하나당 (echo 개수+1)칸씩 구간을 나눠서, 그 레이어 자기 몫의 구간 맨 위에 크리스피한
// 본체가, 그 아래로 echo들이 순서대로(가까운 것부터) 이어지고, 그다음 레이어 구간이 이어지는 식.
// 그려지는 순서: 1.png → 1.png의 echo들(가까운 것→먼 것) → 2.png → 2.png의 echo들 → …
// (z-index는 반드시 정수여야 함 — 예전에 0.5 단위로 사이값을 만들려다 브라우저가 그 값을 통째로
//  무시해서 auto로 떨어지는 버그가 있었음. 정수 구간을 넉넉히 나눠서 그 문제를 원천적으로 피함)
const Z_GROUP_SIZE = computed(() => props.shadowEchoCount + 1)
function layerStyle(i) {
    return {
        zIndex: (props.layers.length - i) * Z_GROUP_SIZE.value,
        height: `${layerHeight.value}px`,
        transform: `translateY(${(-baseShiftFor(i)).toFixed(2)}px)`,
    }
}

// 그림자 트레일: 레이어 이미지를 블러 없이 그대로 복제해서, e(1..shadowEchoCount)가 커질수록 더 아래로
// 내리고 더 옅게 — 겹치는 여러 장으로 계단식 트레일을 만듦(SVG 블러 필터는 줌 중 간헐적으로 사라지는
// 크로미움 버그가 있어서 포기함 — 자세한 사정은 git 이력 참고)
function echoStyle(i, e) {
    const h = layerHeight.value
    const downOffset = h * props.shadowStepRatio * e
    const opacity = props.shadowOpacity 
    return {
        zIndex: (props.layers.length - i) * Z_GROUP_SIZE.value - e,
        height: `${h}px`,
        transform: `translateY(${(-baseShiftFor(i) + downOffset).toFixed(2)}px)`,
        opacity: opacity.toFixed(3),
    }
}
</script>

<style>
.map-item-wrapper {
    position: absolute;
    pointer-events: none;
}

.map-item-stack {
    position: relative;
    width: 100%;
    height: 100%;
}

.map-item-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    display: block;
}
</style>
