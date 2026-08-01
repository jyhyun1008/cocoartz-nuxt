<template>
    <div
        id="wme-container"
        ref="containerRef"
        :style="{ cursor: isDragging ? 'grabbing' : 'default' }"
        @mousedown="onPanStart"
        @mousemove="onPanMove"
        @mouseup="onPanEnd"
        @mouseleave="onPanEnd"
        @contextmenu.prevent
    >

        <!-- z=0 타일 레이어 -->
        <div id="wme-map" :style="mapStyle">
            <div class="maptiles1" :style="tilesScaleStyle">
                <div
                    v-for="tile in tilesBack"
                    :key="`${tile.position.x}-${tile.position.y}-${tile.position.z ?? 0}`"
                    class="tile-container"
                    :style="getTileContainerStyle(tile)"
                >
                    <div class="tile-slice" :style="tileTopSliceStyle">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileTopImgStyle" />
                    </div>
                    <div class="tile-slice" :style="tileSideTopStyle">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideTopImgStyle" />
                    </div>
                    <div class="tile-slice" :style="tileSideMiddleContainerStyle()">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideMiddleImgStyle()" />
                    </div>
                    <div class="tile-slice" :style="tileSideBottomStyle">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideBottomImgStyle" />
                    </div>
                </div>
            </div>
        </div>

        <!-- z≥1 타일 레이어 -->
        <div id="wme-map-front">
            <div class="maptiles-pan" :style="mapStyle">
                <div class="maptiles1" :style="tilesScaleStyle">
                    <div
                        v-for="tile in tilesFront"
                        :key="`${tile.position.x}-${tile.position.y}-${tile.position.z ?? 0}`"
                        class="tile-container"
                        :style="getTileContainerStyle(tile)"
                    >
                        <div class="tile-slice" :style="tileTopSliceStyle">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileTopImgStyle" />
                        </div>
                        <div class="tile-slice" :style="tileSideTopStyle">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideTopImgStyle" />
                        </div>
                        <div class="tile-slice" :style="tileSideMiddleContainerStyle()">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideMiddleImgStyle()" />
                        </div>
                        <div class="tile-slice" :style="tileSideBottomStyle">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideBottomImgStyle" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 편집 그리드 레이어 -->
        <div id="wme-edit-grid-layer">
            <div class="maptiles-pan" :style="mapStyle">
                <div class="maptiles1" :style="tilesScaleStyle">
                    <div
                        v-for="cell in editGridCells"
                        :key="`ec-${cell.x}-${cell.y}`"
                        class="edit-cell"
                        :class="{ 'edit-cell-hover': hoverCell && hoverCell.x === cell.x && hoverCell.y === cell.y }"
                        :style="getEditCellStyle(cell.x, cell.y)"
                        @click.stop="handleCellClick(cell.x, cell.y)"
                        @mouseenter="hoverCell = cell"
                        @mouseleave="hoverCell = null"
                    ></div>
                </div>
            </div>
        </div>

        <!-- 편집 팔레트 -->
        <div id="wme-palette">
            <div class="palette-label">타일</div>
            <div class="palette-tiles-row">
                <div
                    v-for="tid in TILE_IDS"
                    :key="tid"
                    class="palette-tile-btn"
                    :class="{ active: !isErasing && selectedTile === tid }"
                    @click="isErasing = false; selectedTile = tid"
                >
                    <img :src="`/tileset/${tid}.png`" />
                </div>
                <div
                    class="palette-tile-btn erase-btn"
                    :class="{ active: isErasing }"
                    @click="isErasing = true"
                >✕</div>
            </div>
            <div class="palette-label">높이</div>
            <div class="palette-z-row">
                <button
                    v-for="(label, z) in ['바닥', '1층', '2층']"
                    :key="z"
                    class="palette-z-btn"
                    :class="{ active: selectedZ === z }"
                    @click="selectedZ = z"
                >{{ label }}</button>
            </div>
            <div class="palette-actions">
                <button class="palette-cancel-btn" @click="$emit('cancel')">취소</button>
                <button class="palette-save-btn" :disabled="isSaving" @click="saveMap">
                    {{ isSaving ? '저장 중' : '저장' }}
                </button>
            </div>
        </div>

    </div>
</template>

<script setup>
const props = defineProps({
    mapData: { type: String, default: null },
    roomId: { type: Number, required: true },
})

const emit = defineEmits(['saved', 'cancel'])

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()

const TILE_W = 128
const TILE_IMG_H = 128
const TILE_IDS = [1, 2, 3, 4, 5]
const GRID_SIZE = 10

// ─── 패닝 상태 (panX/panY 직접 제어) ──────────
const panX = ref(0)
const panY = ref(0)  // onMounted에서 줌 기준으로 정확히 계산
const isDragging = ref(false)
let dragLastClient = { x: 0, y: 0 }

const mapStyle = computed(() => ({
    left: `${panX.value}px`,
    top: `${panY.value}px`,
}))

function onPanStart(e) {
    if (e.button !== 2) return
    isDragging.value = true
    dragLastClient = { x: e.clientX, y: e.clientY }
    e.preventDefault()
}

function onPanMove(e) {
    if (!isDragging.value) return
    panX.value += e.clientX - dragLastClient.x
    panY.value += e.clientY - dragLastClient.y
    dragLastClient = { x: e.clientX, y: e.clientY }
}

function onPanEnd() {
    isDragging.value = false
}

// ─── 줌 ───────────────────────────────────────
const zoomLevel = ref(0.5)  // 초기에 전체 그리드가 보이도록 축소
const topRatio = computed(() => {
    const raw = zoomLevel.value >= 1.0
        ? 0.5 - (zoomLevel.value - 1.0) / 9
        : 0.5 + (1.0 - zoomLevel.value) * 0.28
    return Math.max(1 / 3, Math.min(0.9, raw))
})

// 줌 피벗: 맵 컨테이너 중앙 (패닝된 뷰 기준)
const tilesScaleStyle = computed(() => ({
    transform: `scale(${zoomLevel.value})`,
    transformOrigin: '50% 50%',
}))

// ─── 편집 상태 ────────────────────────────────
const editTiles = ref([])
const selectedTile = ref(1)
const selectedZ = ref(0)
const isErasing = ref(false)
const hoverCell = ref(null)
const isSaving = ref(false)
const containerRef = ref(null)

const editGridCells = computed(() => {
    const cells = []
    for (let x = 0; x < GRID_SIZE; x++)
        for (let y = 0; y < GRID_SIZE; y++)
            cells.push({ x, y })
    return cells
})

function handleCellClick(x, y) {
    const z = selectedZ.value
    const idx = editTiles.value.findIndex(
        t => t.position.x === x && t.position.y === y && (t.position.z ?? 0) === z
    )
    if (isErasing.value) {
        if (idx !== -1) editTiles.value.splice(idx, 1)
    } else {
        if (idx !== -1) {
            editTiles.value[idx] = { position: { x, y, z }, itemid: selectedTile.value }
        } else {
            editTiles.value.push({ position: { x, y, z }, itemid: selectedTile.value })
        }
    }
}

async function saveMap() {
    isSaving.value = true
    try {
        const mapJson = JSON.stringify([editTiles.value])
        await $fetch(`${apiBaseUrl}/api/admin/saveRoomMap`, {
            method: 'POST',
            body: { userid: userId.value, id: props.roomId, map: mapJson },
        })
        emit('saved', mapJson)
    } catch {
        alert('저장에 실패했습니다.')
    } finally {
        isSaving.value = false
    }
}

function getEditCellStyle(x, y) {
    const dynH = TILE_IMG_H * topRatio.value
    const screenX = (x - y) * (TILE_W / 2)
    const screenY = (x + y) * (dynH / 2)
    return {
        position: 'absolute',
        left: `calc(50% + ${screenX - TILE_W / 2}px)`,
        top: `calc(50% + ${screenY - dynH / 2}px)`,
        width: `${TILE_W}px`,
        height: `${dynH}px`,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        cursor: isErasing.value ? 'cell' : 'crosshair',
        zIndex: 50000,
    }
}

// ─── 타일 렌더링 ──────────────────────────────
function buildDefaultMap() {
    const tiles = []
    for (let x = 0; x < 6; x++) {
        for (let y = 0; y < 6; y++) {
            const border = x === 0 || y === 0 || x === 5 || y === 5
            tiles.push({ position: { x, y, z: 0 }, itemid: border ? 5 : 1 })
        }
    }
    return [tiles]
}

const mapInfo = computed(() => {
    if (!props.mapData) return buildDefaultMap()
    try { return JSON.parse(props.mapData) } catch { return buildDefaultMap() }
})

const sortedTiles = computed(() =>
    [...editTiles.value].sort((a, b) => {
        const az = a.position.z ?? 0
        const bz = b.position.z ?? 0
        return (a.position.x + a.position.y + az * 2) - (b.position.x + b.position.y + bz * 2)
    })
)

const tilesBack = computed(() => sortedTiles.value.filter(t => (t.position.z ?? 0) === 0))
const tilesFront = computed(() => sortedTiles.value.filter(t => (t.position.z ?? 0) >= 1))

function getFilePath(tile) { return `/tileset/${tile.itemid}.png` }

function getTileContainerStyle(tile) {
    const { x, y, z = 0 } = tile.position
    const dynH = TILE_IMG_H * topRatio.value
    const S = (1 - topRatio.value) * TILE_IMG_H
    const sideH = dynH * 3 / 4 + S / 2
    const screenX = (x - y) * (TILE_W / 2)
    const screenY = (x + y) * (dynH / 2) - z * sideH
    const scale = (1 + (x + y) * 0.004).toFixed(3)
    return {
        left: `calc(50% + ${screenX - TILE_W / 2}px)`,
        top: `calc(50% + ${screenY - dynH / 2}px)`,
        transform: `scale(${scale})`,
        zIndex: (x + y) * 10 + z * 2 + 10000,
    }
}

const tileTopSliceStyle = computed(() => ({ height: `${topRatio.value * TILE_IMG_H}px` }))
const tileTopImgStyle = computed(() => ({ width: '128px', height: `${TILE_IMG_H * 2 * topRatio.value}px` }))
const tileSideTopStyle = computed(() => ({ height: `${topRatio.value * TILE_IMG_H / 4}px` }))
const tileSideTopImgStyle = computed(() => ({
    width: '128px',
    height: `${TILE_IMG_H * 2 * topRatio.value}px`,
    marginTop: `${-TILE_IMG_H * topRatio.value}px`,
}))
function tileSideMiddleContainerStyle() {
    const S = (1 - topRatio.value) * TILE_IMG_H
    return { height: `${S / 2}px` }
}
function tileSideMiddleImgStyle() {
    const S = (1 - topRatio.value) * TILE_IMG_H
    return { width: '128px', height: `${4 * S}px`, marginTop: `${-5 * S / 2}px` }
}
const tileSideBottomStyle = computed(() => ({ height: `${topRatio.value * TILE_IMG_H / 2}px` }))
const tileSideBottomImgStyle = computed(() => ({
    width: '128px',
    height: `${topRatio.value * TILE_IMG_H * 2}px`,
    marginTop: `${-topRatio.value * TILE_IMG_H * 3 / 2}px`,
}))

onMounted(() => {
    editTiles.value = JSON.parse(JSON.stringify(mapInfo.value?.[0] ?? []))

    // 초기 panY: 그리드 중앙이 화면 중앙에 오도록 계산
    // tile (cx,cy) 중심 screen_y = panY + H/2 + screenY*z  (screenY = (cx+cy)*(dynH/2))
    // 중앙 정렬: panY = -(GRID_SIZE-1)*(dynH/2)*z
    const z = zoomLevel.value
    const raw = z >= 1 ? 0.5 - (z - 1) / 9 : 0.5 + (1 - z) * 0.28
    const tr = Math.max(1 / 3, Math.min(0.9, raw))
    panY.value = -Math.round((GRID_SIZE - 1) * (tr * 128 / 2) * z)

    containerRef.value?.addEventListener('wheel', (e) => {
        e.preventDefault()
        e.stopPropagation()  // 배경 RoomMap 줌 방지
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        zoomLevel.value = Math.max(0.3, Math.min(2.5, zoomLevel.value + delta))
    }, { passive: false })
})
</script>

<style>
#wme-container {
    position: relative;
    width: 100%;
    height: 380px;
    border-radius: 10px;
    overflow: hidden;
    background-color: var(--mapbg, #888);
    --char-width: 100%;
    --char-height: 380px;
    user-select: none;
}

#wme-map {
    width: 100%;
    height: 100%;
    position: relative;
    animation: handheld 9s ease-in-out infinite;
}

#wme-map-front {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    animation: handheld 9s ease-in-out infinite;
}

#wme-map-front .maptiles-pan {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
}

#wme-edit-grid-layer {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    animation: handheld 9s ease-in-out infinite;
}

#wme-edit-grid-layer .maptiles-pan {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
}

#wme-edit-grid-layer .maptiles1 {
    pointer-events: none;
}

#wme-palette {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 60000;
    background: rgba(20, 20, 28, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 160px;
}
</style>
