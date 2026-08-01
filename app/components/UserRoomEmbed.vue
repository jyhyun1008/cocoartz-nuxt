<template>
    <div
        id="ure-container"
        ref="containerRef"
        :style="{ cursor: isDragging ? 'grabbing' : 'default' }"
        @mousedown="onPanStart"
        @mousemove="onPanMove"
        @mouseup="onPanEnd"
        @mouseleave="onPanEnd"
        @contextmenu.prevent
    >

        <!-- z=0 타일 레이어 -->
        <div id="ure-map" :style="mapStyle">
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
                    <div class="tile-slice" :style="tileSideMiddleContainerStyle(tile)">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideMiddleImgStyle(tile)" />
                    </div>
                    <div class="tile-slice" :style="tileSideBottomStyle">
                        <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideBottomImgStyle" />
                    </div>
                </div>
            </div>
        </div>

        <!-- z≥1 타일 + 캐릭터 레이어 -->
        <div id="ure-map-front">
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
                        <div class="tile-slice" :style="tileSideMiddleContainerStyle(tile)">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideMiddleImgStyle(tile)" />
                        </div>
                        <div class="tile-slice" :style="tileSideBottomStyle">
                            <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideBottomImgStyle" />
                        </div>
                    </div>
                    <CharacterMoving
                        v-if="!isEditMode"
                        :layers="localCharLayers"
                        :top-ratio="topRatio"
                        :zoom-level="zoomLevel"
                        :tile-mode="true"
                        :local-x="localPosition.x"
                        :local-y="localPosition.y"
                        :z-index="charZIndex"
                    />
                </div>
            </div>
        </div>

        <!-- 편집 그리드 레이어 (편집 모드에서만 표시) -->
        <div v-if="isEditMode" id="ure-edit-grid-layer">
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
        <div v-if="isEditMode" id="ure-palette">
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
                <button class="palette-cancel-btn" @click="cancelEdit">취소</button>
                <button class="palette-save-btn" :disabled="isSaving" @click="saveMap">
                    {{ isSaving ? '저장 중' : '저장' }}
                </button>
            </div>
        </div>

        <!-- 방 꾸미기 버튼 -->
        <button v-if="isOwn && !isEditMode" id="ure-edit-btn" @click="enterEditMode">
            ✎ 방 꾸미기
        </button>

    </div>
</template>

<script setup>
const props = defineProps({
    mapData: { type: String, default: null },
    username: { type: String, required: true },
    isOwn: { type: Boolean, default: false },
    ownUserId: { type: Number, default: 0 },
})

const emit = defineEmits(['map-saved'])

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

const TILE_W = 128
const TILE_IMG_H = 128
const TILE_IDS = [1, 2, 3, 4, 5]
const GRID_SIZE = 10

// ─── 편집 상태 ───────────────────────────────
const isEditMode = ref(false)
const editTiles = ref([])
const selectedTile = ref(1)
const selectedZ = ref(0)
const isErasing = ref(false)
const hoverCell = ref(null)
const isSaving = ref(false)

const editGridCells = computed(() => {
    const cells = []
    for (let x = 0; x < GRID_SIZE; x++)
        for (let y = 0; y < GRID_SIZE; y++)
            cells.push({ x, y })
    return cells
})

function enterEditMode() {
    editTiles.value = JSON.parse(JSON.stringify(mapInfo.value?.[0] ?? []))
    isEditMode.value = true
}

function cancelEdit() {
    isEditMode.value = false
    editTiles.value = []
    hoverCell.value = null
}

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
        await $fetch(`${apiBaseUrl}/api/saveUserMap`, {
            method: 'POST',
            body: { userid: props.ownUserId, map: mapJson },
        })
        emit('map-saved', mapJson)
        isEditMode.value = false
        hoverCell.value = null
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

// ─── 맵/타일 렌더링 ──────────────────────────
const zoomLevel = ref(1)
const topRatio = computed(() => {
    const raw = zoomLevel.value >= 1.0
        ? 0.5 - (zoomLevel.value - 1.0) / 9
        : 0.5 + (1.0 - zoomLevel.value) * 0.28
    return Math.max(1 / 3, Math.min(0.9, raw))
})

const localPosition = ref({ x: 0, y: 0 })
const mapLeft = ref(0)
const mapTop = ref(0)
const charDepth = ref(0)
const containerRef = ref(null)

const mapStyle = computed(() => ({
    left: `${mapLeft.value}px`,
    top: `${mapTop.value}px`,
}))

function calcMapTopOffset() {
    const z = zoomLevel.value
    const charBotH = z >= 1 ? 64 : Math.round(31 + 33 * (z - 0.7) / 0.3)
    const dynH = topRatio.value * 128
    return Math.round((16 + charBotH - dynH / 2) * z)
}

function updateMapPosition(pos) {
    mapLeft.value = pos.x * (-32)
    mapTop.value = Math.round(pos.y * topRatio.value * 64) + calcMapTopOffset()
}

function buildDefaultMap() {
    const tiles = []
    for (let x = 0; x < 6; x++) {
        for (let y = 0; y < 6; y++) {
            const border = x === 0 || y === 0 || x === 5 || y === 5
            tiles.push({ position: { x, y, z: 0 }, itemid: border ? 5 : 1 })
        }
    }
    tiles.push({ position: { x: 2, y: 2, z: 1 }, itemid: 5 })
    tiles.push({ position: { x: 3, y: 2, z: 1 }, itemid: 5 })
    return [tiles]
}

const mapInfo = computed(() => {
    if (!props.mapData) return buildDefaultMap()
    try { return JSON.parse(props.mapData) } catch { return buildDefaultMap() }
})

// 편집 모드면 editTiles, 아니면 저장된 mapInfo 사용
const displayTiles = computed(() =>
    isEditMode.value ? editTiles.value : (mapInfo.value?.[0] ?? [])
)

const sortedTiles = computed(() => {
    return [...displayTiles.value].sort((a, b) => {
        const az = a.position.z ?? 0
        const bz = b.position.z ?? 0
        return (a.position.x + a.position.y + az * 2) - (b.position.x + b.position.y + bz * 2)
    })
})

const tilesBack = computed(() => sortedTiles.value.filter(t => (t.position.z ?? 0) === 0))
const tilesFront = computed(() => sortedTiles.value.filter(t => (t.position.z ?? 0) >= 1))
const charZIndex = computed(() => localPosition.value.y * -10 + 9999)

function getFilePath(tile) { return `/tileset/${tile.itemid}.png` }

function getTileContainerStyle(tile) {
    const { x, y, z = 0 } = tile.position
    const dynH = TILE_IMG_H * topRatio.value
    const S = (1 - topRatio.value) * TILE_IMG_H
    const sideH = dynH * 3 / 4 + S / 2
    const screenX = (x - y) * (TILE_W / 2)
    const screenY = (x + y) * (dynH / 2) - z * sideH
    const scale = (1 + (x + y) * 0.004).toFixed(3)
    const depthDiff = Math.abs((x + y) - charDepth.value)
    const blur = (Math.min(depthDiff * 1.2, 6) / Math.max(zoomLevel.value, 1)).toFixed(1)
    return {
        left: `calc(50% + ${screenX - TILE_W / 2}px)`,
        top: `calc(50% + ${screenY - dynH / 2}px)`,
        transform: `scale(${scale})`,
        filter: (!isEditMode.value && Number(blur) > 0) ? `blur(${blur}px)` : undefined,
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
const tilesScaleStyle = computed(() => {
    const ox = localPosition.value.x * 32
    const oy = -localPosition.value.y * topRatio.value * 64
    return {
        transform: `scale(${zoomLevel.value})`,
        transformOrigin: `calc(50% + ${ox}px) calc(50% + ${oy}px)`,
    }
})

// 패닝용 position (WASD + drag 공유)
const { userData: currentUserData, ensureLoaded: ensureUserLoaded } = useCurrentUserData()
const localCharLayers = computed(() => getCharacterLayers(currentUserData.value?.character))

const position = { x: 0, y: 0 }

// username은 비동기로 로드되므로, 준비됐을 때 localStorage에서 position 복원
watch(() => props.username, (newUsername) => {
    if (!newUsername) return
    try {
        const stored = localStorage.getItem(`ur-pos-${newUsername}`)
        if (stored) {
            const parsed = JSON.parse(stored)
            position.x = parsed.x ?? 0
            position.y = parsed.y ?? 0
        } else {
            position.x = 0
            position.y = 0
        }
    } catch {}
    localPosition.value = { ...position }
    charDepth.value = -position.y + 2
    updateMapPosition(position)
})

const isDragging = ref(false)
let dragLastClient = { x: 0, y: 0 }

function onPanStart(e) {
    if (e.button !== 2) return
    isDragging.value = true
    dragLastClient = { x: e.clientX, y: e.clientY }
    e.preventDefault()
}

function onPanMove(e) {
    if (!isDragging.value) return
    const dx = e.clientX - dragLastClient.x
    const dy = e.clientY - dragLastClient.y
    dragLastClient = { x: e.clientX, y: e.clientY }
    position.x -= dx / 32
    position.y += dy / (topRatio.value * 64)
    localPosition.value = { ...position }
    charDepth.value = -position.y + 2
    updateMapPosition(position)
    try { localStorage.setItem(storageKey.value, JSON.stringify({ x: position.x, y: position.y })) } catch {}
}

function onPanEnd() {
    isDragging.value = false
}

const storageKey = computed(() => `ur-pos-${props.username}`)

onMounted(() => {
    ensureUserLoaded()

    window.addEventListener('keydown', (e) => {
        if (isEditMode.value) return
        const moves = { KeyS: [0, -0.25], KeyW: [0, 0.25], KeyA: [-0.25, 0], KeyD: [0.25, 0] }
        const delta = moves[e.code]
        if (!delta) return
        position.x += delta[0]
        position.y += delta[1]
        localPosition.value = { ...position }
        charDepth.value = -position.y + 2
        updateMapPosition(position)
        localStorage.setItem(storageKey.value, JSON.stringify(position))
    })

    containerRef.value?.addEventListener('wheel', (e) => {
        if (isEditMode.value) return
        e.preventDefault()
        e.stopPropagation()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        zoomLevel.value = Math.max(0.7, Math.min(2.5, zoomLevel.value + delta))
        updateMapPosition(position)
    }, { passive: false })
})
</script>

<style>
#ure-container {
    position: relative;
    width: 100%;
    height: 300px;
    border-radius: 12px;
    overflow: hidden;
    background-color: var(--mapbg, #888);
    --char-width: 100%;
    --char-height: 300px;
}

#ure-container.edit-active {
    height: 420px;
    --char-height: 420px;
}

#ure-map {
    width: 100%;
    height: 100%;
    position: relative;
    animation: handheld 9s ease-in-out infinite;
}

#ure-map-front {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    animation: handheld 9s ease-in-out infinite;
}

#ure-map-front .maptiles-pan {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
}

/* 편집 그리드 레이어 */
#ure-edit-grid-layer {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    animation: handheld 9s ease-in-out infinite;
}

#ure-edit-grid-layer .maptiles-pan {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
}

#ure-edit-grid-layer .maptiles1 {
    pointer-events: none;
}

.edit-cell {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: background 0.1s;
}

.edit-cell-hover {
    background: rgba(255, 255, 255, 0.28) !important;
}

/* 편집 팔레트 */
#ure-palette {
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

.palette-label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.palette-tiles-row {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}

.palette-tile-btn {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: 2px solid transparent;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: border-color 0.1s, background 0.1s;
    flex-shrink: 0;
}

.palette-tile-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
}

.palette-tile-btn.active {
    border-color: var(--accent, #D21F3C);
    background: rgba(210, 31, 60, 0.2);
}

.palette-tile-btn:hover:not(.active) {
    background: rgba(255, 255, 255, 0.18);
}

.erase-btn {
    color: rgba(255, 255, 255, 0.7);
    font-size: 1rem;
    font-weight: 700;
}

.erase-btn.active {
    border-color: #ff6b6b;
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
}

.palette-z-row {
    display: flex;
    gap: 4px;
}

.palette-z-btn {
    flex: 1;
    padding: 4px 0;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.1s;
}

.palette-z-btn.active {
    background: var(--accent, #D21F3C);
    border-color: var(--accent, #D21F3C);
    color: white;
}

.palette-actions {
    display: flex;
    gap: 6px;
    margin-top: 2px;
}

.palette-cancel-btn, .palette-save-btn {
    flex: 1;
    padding: 6px 0;
    border-radius: 7px;
    border: none;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    font-weight: 600;
    transition: opacity 0.15s;
}

.palette-cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
}

.palette-cancel-btn:hover { background: rgba(255, 255, 255, 0.18); }

.palette-save-btn {
    background: var(--accent, #D21F3C);
    color: white;
}

.palette-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.palette-save-btn:not(:disabled):hover { opacity: 0.85; }

/* 방 꾸미기 버튼 */
#ure-edit-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 60000;
    background: rgba(20, 20, 28, 0.85);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
    font-family: inherit;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

#ure-edit-btn:hover {
    background: var(--accent, #D21F3C);
    border-color: var(--accent, #D21F3C);
    color: white;
}
</style>
