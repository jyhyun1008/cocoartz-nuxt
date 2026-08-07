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

        <!-- 통합 레이어: 타일(z 무관) + 아이템 → 전부 같은 스태킹 컨텍스트에서 z-index 하나로 깊이 결정.
             예전엔 z=0/z≥1을 #wme-map/#wme-map-front 두 개로 쪼개서 렌더했는데, 이 둘이 서로 다른(뒤/앞
             고정) 스태킹 컨텍스트라 z≥1 쪽이 내부 z-index값과 무관하게 항상 z=0 쪽 위에 그려졌음 —
             그래서 z=0 아이템이 바로 옆 z≥1 블록보다 실제로는 더 앞이어야 하는데도 항상 블록한테
             가려지는 버그가 있었음(RoomMap.vue는 먼저 이렇게 통합해서 고쳐뒀었음). -->
        <div id="wme-map-front">
            <div class="maptiles-pan" :style="mapStyle">
                <div class="maptiles1" :style="tilesScaleStyle">
                    <div
                        v-for="tile in sortedTiles"
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
                    <MapItem
                        v-for="(item, idx) in editItems"
                        :key="`wme-item-${item.position.x}-${item.position.y}-${item.position.z ?? 0}-${idx}`"
                        :layers="getItemLayers(item.itemid)"
                        :position="item.position"
                        :top-ratio="topRatio"
                        :flip-x="!!item.flip"
                        :flip-back="!!item.flipBack"
                        :flip-back-offsets="getItemFlipBackOffsets(item.itemid)"
                        :editable="placementMode === 'select'"
                        :selected="selectedEditIndex === idx"
                        @select="selectedEditIndex = idx"
                    />
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
                        :class="{
                            'edit-cell-hover': hoverCell && hoverCell.x === cell.x && hoverCell.y === cell.y,
                            'edit-cell-passthrough': placementMode === 'select' && !movePending,
                        }"
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
                    :class="{ active: placementMode === 'tile' && !isErasing && selectedTile === tid }"
                    @click="placementMode = 'tile'; isErasing = false; selectedTile = tid"
                >
                    <img :src="`/tileset/${tid}.png`" />
                </div>
                <div
                    class="palette-tile-btn erase-btn"
                    :class="{ active: placementMode === 'tile' && isErasing }"
                    @click="placementMode = 'tile'; isErasing = true"
                ><i class="hgi hgi-stroke hgi-eraser"></i></div>
            </div>
            <div class="palette-label">아이템</div>
            <div class="palette-tiles-row">
                <div
                    v-for="def in ITEM_CATALOG"
                    :key="def.id"
                    class="palette-tile-btn palette-item-btn"
                    :class="{ active: placementMode === 'item' && !isErasing && selectedItem === def.id }"
                    :title="def.name"
                    @click="placementMode = 'item'; isErasing = false; selectedItem = def.id"
                >
                    <img
                        v-for="(src, i) in def.layers"
                        :key="src"
                        :src="src"
                        :style="itemThumbLayerStyle(def.layers.length, i)"
                    />
                </div>
                <div
                    class="palette-tile-btn erase-btn"
                    :class="{ active: placementMode === 'item' && isErasing }"
                    @click="placementMode = 'item'; isErasing = true"
                ><i class="hgi hgi-stroke hgi-eraser"></i></div>
            </div>
            <button
                class="palette-flip-btn select-mode-btn"
                :class="{ active: placementMode === 'select' }"
                @click="placementMode = 'select'; deselectItem()"
            ><i class="hgi hgi-stroke hgi-mouse-left-click-01"></i> 배치된 아이템 선택/편집</button>

            <template v-if="placementMode !== 'select'">
                <div class="palette-flip-row">
                    <button
                        class="palette-flip-btn"
                        :class="{ active: selectedFlip }"
                        @click="selectedFlip = !selectedFlip"
                    ><i class="hgi hgi-stroke hgi-flip-horizontal"></i> 좌우반전</button>
                    <button
                        class="palette-flip-btn"
                        :class="{ active: selectedFlipBack }"
                        @click="selectedFlipBack = !selectedFlipBack"
                    ><i class="hgi hgi-stroke hgi-rotate-clockwise"></i> 뒤로 돌리기</button>
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
            </template>

            <!-- 배치된 아이템 선택/편집 패널 -->
            <template v-else>
                <div v-if="!selectedEditItem" class="palette-hint">편집할 아이템을 지도에서 클릭하세요</div>
                <template v-else>
                    <div class="palette-flip-row">
                        <button
                            class="palette-flip-btn"
                            :class="{ active: selectedEditItem.flip }"
                            @click="selectedEditItem.flip = !selectedEditItem.flip"
                        ><i class="hgi hgi-stroke hgi-flip-horizontal"></i> 좌우반전</button>
                        <button
                            class="palette-flip-btn"
                            :class="{ active: selectedEditItem.flipBack }"
                            @click="selectedEditItem.flipBack = !selectedEditItem.flipBack"
                        ><i class="hgi hgi-stroke hgi-rotate-clockwise"></i> 뒤로 돌리기</button>
                    </div>
                    <div class="palette-label">층</div>
                    <div class="palette-z-row">
                        <button
                            v-for="(label, z) in ['바닥', '1층', '2층']"
                            :key="z"
                            class="palette-z-btn"
                            :class="{ active: (selectedEditItem.position.z ?? 0) === z }"
                            @click="selectedEditItem.position.z = z"
                        >{{ label }}</button>
                    </div>
                    <button
                        class="palette-flip-btn"
                        :class="{ active: movePending }"
                        @click="startMoveSelected"
                    ><i class="hgi hgi-stroke hgi-cursor-move-02"></i> {{ movePending ? '이동할 칸을 클릭하세요…' : '위치 이동' }}</button>
                    <label class="palette-label">제목</label>
                    <input v-model="selectedEditItem.title" class="palette-text-input" placeholder="예: 공지사항" />
                    <label class="palette-label">링크</label>
                    <input v-model="selectedEditItem.link" class="palette-text-input" placeholder="/board/notice 또는 https://..." />
                    <div class="palette-actions">
                        <button class="palette-cancel-btn" @click="deselectItem">선택 해제</button>
                        <button class="palette-cancel-btn palette-danger-btn" @click="deleteSelectedItem">삭제</button>
                    </div>
                </template>
            </template>

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
const { ITEM_CATALOG, getItemLayers, getItemFlipBackOffsets } = useItemCatalog()

// 아이템 팔레트 썸네일: layers[0] 한 장만 보여주면 실제로 배치했을 때 모양(6장 겹친 스택)이랑
// 달라 보여서 헷갈리니까, 작은 버튼 안에서도 대충 같은 방향으로 살짝씩 겹쳐 쌓아 미리보기를 만듦.
// MapItem.vue처럼 줌에 따른 정밀한 squash/gap 계산은 필요 없음(아이콘이 작아서 티도 안 남) —
// 고정 픽셀 오프셋으로 충분함.
function itemThumbLayerStyle(total, i) {
    const stepsFromGround = total - 1 - i
    return {
        zIndex: total - i,
        bottom: `0px`,
    }
}

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
const editItems = ref([])
// 'tile' | 'item' — 팔레트에서 뭘 골랐느냐에 따라 클릭했을 때 타일을 놓을지 아이템을 놓을지 결정
const placementMode = ref('tile')
const selectedTile = ref(1)
const selectedItem = ref(ITEM_CATALOG[0]?.id ?? 1)
const selectedZ = ref(0)
// 다음에 놓을 아이템의 좌우반전 여부 — 이미 놓인 아이템 하나하나를 다시 클릭해서 뒤집는 기능은
// 아니고(타일처럼 "지우고 다시 놓기" 방식), 팔레트에서 미리 켜두면 그 상태로 놓임
const selectedFlip = ref(false)
// 다음에 놓을 아이템의 "뒤로 돌리기" 여부 — 좌우반전이랑 같은 방식(미리 켜고 놓기)
const selectedFlipBack = ref(false)
const isErasing = ref(false)
const hoverCell = ref(null)
const isSaving = ref(false)
const containerRef = ref(null)

// ─── 배치된 아이템 선택/편집 ('select' 모드에서만 동작, 타일에는 영향 없음) ──────
const selectedEditIndex = ref(null)
const movePending = ref(false)
const selectedEditItem = computed(() => selectedEditIndex.value !== null ? editItems.value[selectedEditIndex.value] : null)

function deselectItem() {
    selectedEditIndex.value = null
    movePending.value = false
}

function startMoveSelected() {
    movePending.value = true
}

function deleteSelectedItem() {
    if (selectedEditIndex.value === null) return
    editItems.value.splice(selectedEditIndex.value, 1)
    deselectItem()
}

const editGridCells = computed(() => {
    const cells = []
    for (let x = 0; x < GRID_SIZE; x++)
        for (let y = 0; y < GRID_SIZE; y++)
            cells.push({ x, y })
    return cells
})

function handleCellClick(x, y) {
    const z = selectedZ.value
    if (placementMode.value === 'select') {
        // 아이템 자체를 직접 클릭해서 고르는 방식으로 바뀜(MapItem의 editable/select 이벤트) —
        // 여기까지 클릭이 도달하는 건 이동 대상을 고르는 중(movePending)이거나, 빈 칸을 클릭한 경우.
        if (movePending.value && selectedEditIndex.value !== null) {
            editItems.value[selectedEditIndex.value].position = { x, y, z }
        }
        movePending.value = false
        return
    }
    if (placementMode.value === 'item') {
        const idx = editItems.value.findIndex(
            it => it.position.x === x && it.position.y === y && (it.position.z ?? 0) === z
        )
        if (isErasing.value) {
            if (idx !== -1) editItems.value.splice(idx, 1)
        } else if (idx !== -1) {
            editItems.value[idx] = { position: { x, y, z }, itemid: selectedItem.value, flip: selectedFlip.value, flipBack: selectedFlipBack.value }
        } else {
            editItems.value.push({ position: { x, y, z }, itemid: selectedItem.value, flip: selectedFlip.value, flipBack: selectedFlipBack.value })
        }
        return
    }
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
        const mapJson = JSON.stringify([editTiles.value, editItems.value])
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

function getFilePath(tile) { return `/tileset/${tile.itemid}.png` }

function getTileContainerStyle(tile) {
    const { x, y, z = 0 } = tile.position
    const dynH = TILE_IMG_H * topRatio.value
    const S = (1 - topRatio.value) * TILE_IMG_H
    const sideH = dynH * 3 / 4 + S / 2
    const screenX = (x - y) * (TILE_W / 2)
    const screenY = (x + y) * (dynH / 2) - z * sideH
    const scale = (1 + (x + y) * 0.004).toFixed(3)
    // z-index는 RoomMap.vue의 getTileContainerStyle과 반드시 같은 "4n+k" 스케일(n=x+y, k=z)을
    // 써야 함 — 여기만 n=x+y+2z로 따로 놀고 있어서 편집 화면과 실제 맵 화면의 z-index가
    // 어긋나는(같은 배치인데 가려지는 순서가 다르게 보이는) 버그가 있었음
    const n = x + y
    const k = z
    return {
        left: `calc(50% + ${screenX - TILE_W / 2}px)`,
        top: `calc(50% + ${screenY - dynH / 2}px)`,
        transform: `scale(${scale})`,
        zIndex: 4 * n + k,
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
    editItems.value = JSON.parse(JSON.stringify(mapInfo.value?.[1] ?? []))

    // 초기 panY: 그리드 중앙이 화면 중앙에 오도록 계산
    // tile (cx,cy) 중심 screen_y = panY + H/2 + screenY*z  (screenY = (cx+cy)*(dynH/2))
    // 중앙 정렬: panY = -(GRID_SIZE-1)*(dynH/2)*z
    const z = zoomLevel.value
    const raw = z >= 1 ? 0.5 - (z - 1) / 9 : 0.5 + (1 - z) * 0.28
    const tr = Math.max(1 / 3, Math.min(0.9, raw))
    panY.value = -Math.round((GRID_SIZE - 1) * (tr * 128 / 2) * z)

    containerRef.value?.addEventListener('wheel', (e) => {
        // 팔레트(#wme-palette) 안에서의 스크롤은 지도 줌으로 먹지 않고 그대로 통과시켜서
        // 패널 내부 스크롤(overflow-y:auto)이 정상 동작하게 함 — 안 그러면 이 리스너가
        // 컨테이너 전체에 걸려있어서 팔레트 안에서 휠을 굴려도 항상 줌으로 가로채버림
        if (e.target.closest('#wme-palette')) return
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
    /* 이 편집기는 WindowSettings.vue의 관리자 모달(채널 맵 편집)에서만 쓰여서 이미 큰 모달 공간을
       그대로 채워도 됨 — 고정 380px 대신 부모(#settings-content, flex column)가 주는 높이만큼
       늘어나게 함(부모 쪽도 이 뷰일 때 모달 자체를 키워서 늘어날 공간을 넉넉히 줌) */
    flex: 1 1 auto;
    min-height: 380px;
    border-radius: 10px;
    overflow: hidden;
    background-color: var(--mapbg, #888);
    --char-width: 100%;
    --char-height: 100%;
    user-select: none;
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

/* .edit-cell도 팔레트와 같은 문제였음: UserRoomEmbed.vue에만 pointer-events:auto가 정의돼 있어서
   그 컴포넌트가 같이 로드 안 된 페이지에서는 조상의 pointer-events:none을 그대로 물려받아
   그리드를 클릭해도 아무 반응이 없었음(=편집 불가) */
.edit-cell {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: background 0.1s;
}

.edit-cell-hover {
    background: rgba(255, 255, 255, 0.28) !important;
}

/* 선택 모드에서 "고르는" 단계(이동 대상 고르는 중 아님)는 이 그리드가 클릭을 먼저 채가면 안 됨 —
   그리드는 z 상관없이 바닥(z=0) 평면 위치로만 계산돼서, 위층(z>0)에 떠 있는 아이템을 화면에 보이는
   그대로 클릭했을 때 엉뚱한 칸으로 인식되는 문제가 있었음. 그래서 이 단계에서는 그리드를 완전히
   투명(pointer-events:none)하게 만들어서 클릭이 아이템(MapItem, editable prop으로 직접 클릭 받음)
   에 그대로 통과되게 함 — 이동 대상을 고르는 단계(movePending)에서는 다시 필요하니 그대로 둠 */
.edit-cell.edit-cell-passthrough {
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
    /* 편집 패널이 추가되면서 내용이 #wme-container(고정 380px, overflow:hidden)보다 길어져서
       아래쪽이 그냥 잘려 보이던 문제 — 패널 자체 높이를 컨테이너 안으로 제한하고 내부 스크롤로 처리 */
    max-height: calc(100% - 20px);
    overflow-y: auto;
}

/* 팔레트 안 타일 스와치 — UserRoomEmbed.vue의 같은 이름 클래스에 기대서 크기가 잡혔었는데
   그 컴포넌트가 같이 마운트 안 되는 페이지(설정 > 맵 편집)에서는 크기 규칙이 아예 없어서
   원본 타일 이미지 크기 그대로 패널을 넘치도록 렌더됐음 → 여기서도 직접 정의해줌 */
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

/* 아이템 팔레트 버튼: layers[]를 여러 장 겹쳐 쌓아야 해서 위 규칙(꽉 채우는 이미지 1장)을
   같은 태그+클래스 선택자로 덮어씀 — 소스 순서상 뒤에 오는 규칙이 이김 */
.palette-item-btn {
    position: relative;
}
.palette-item-btn img {
    position: absolute;
    left: 50%;
    width: 90%;
    height: auto;
    transform: translateX(-50%);
    object-fit: contain;
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

.palette-flip-btn {
    width: 100%;
    padding: 4px 0;
    margin-bottom: 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.1s;
}

/* 좌우반전/뒤로 돌리기는 한 줄에 나란히 — 각 버튼은 폭 100%를 그대로 쓰면 줄이 나뉘니
   이 행 안에서만 width를 자동으로 풀고 flex:1로 반씩 나눠 가짐 */
.palette-flip-row {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
}

.palette-flip-row .palette-flip-btn {
    width: auto;
    flex: 1;
    margin-bottom: 0;
    min-width: 0;
}

.palette-flip-btn.active {
    background: var(--accent, #D21F3C);
    border-color: var(--accent, #D21F3C);
    color: white;
}

.select-mode-btn {
    margin-bottom: 2px;
}

.palette-hint {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.45);
    padding: 6px 2px;
    line-height: 1.5;
}

.palette-text-input {
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.78rem;
    font-family: inherit;
    box-sizing: border-box;
    margin-bottom: 4px;
}
.palette-text-input::placeholder { color: rgba(255, 255, 255, 0.3); }
.palette-text-input:focus { outline: none; border-color: var(--accent, #D21F3C); }

.palette-danger-btn {
    background: rgba(255, 107, 107, 0.15) !important;
    color: #ff6b6b !important;
}
.palette-danger-btn:hover { background: rgba(255, 107, 107, 0.28) !important; }

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
</style>
