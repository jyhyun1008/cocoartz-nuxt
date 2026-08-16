<template>
    <div
        id="wme-container"
        ref="containerRef"
        :style="{ cursor: isDragging ? 'grabbing' : 'default', ...wmeBgStyle }"
        @mousedown="onPanStart"
        @mousemove="onPanMove"
        @mouseup="onPanEnd"
        @mouseleave="onPanEnd"
        @contextmenu.prevent
    >

        <!-- 모바일 전용 안내 문구 — 데스크톱은 우클릭+드래그로 패닝하는데 모바일엔 그 방법이 없어서
             한 손가락 드래그(=패닝)/두 손가락 핀치(=줌)로 조작이 다르다는 걸 안내함. CSS 미디어쿼리로
             모바일에서만 보이게 함(#wme-mobile-hint). -->
        <div id="wme-mobile-hint">한 손가락 드래그로 화면 이동 · 두 손가락으로 확대/축소</div>

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
                        :layer-opacities="getCropGrowth(getItemDef(item.itemid), item.plantedAt)?.layerOpacities ?? []"
                        :editable="placementMode === 'select'"
                        :selected="selectedEditIndex === idx"
                        @select="selectedEditIndex = idx"
                    />
                    <!-- 스폰 지점 표시(편집기 전용 — 실제 맵에는 안 그림). 지도 앱 핀처럼
                         아래로 뾰족한 물방울 모양 — border-radius로 한쪽 모서리만 각지게 두고 45도
                         돌리는 전형적인 CSS 핀 트릭. 안쪽 아이콘은 그 회전을 다시 반대로 상쇄해서
                         똑바로 보이게 함 -->
                    <div class="spawn-marker" :style="getSpawnMarkerStyle()">
                        <i class="hgi hgi-stroke hgi-flag-02 spawn-marker-icon"></i>
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
                    v-for="tid in paletteTileIds"
                    :key="tid"
                    class="palette-tile-btn"
                    :class="{ active: placementMode === 'tile' && !isErasing && selectedTile === tid }"
                    @click="placementMode = 'tile'; isErasing = false; selectedTile = tid"
                >
                    <img :src="getFilePath({ itemid: tid })" />
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
                    v-for="def in paletteItems"
                    :key="def.id"
                    class="palette-tile-btn palette-item-btn"
                    :class="{ active: placementMode === 'item' && !isErasing && selectedItem === def.id }"
                    :title="isUserMode ? `${def.name} (보유 ${ownedCounts.get(def.id) ?? 0}개 중 ${availableCount(def.id)}개 배치 가능)` : def.name"
                    @click="placementMode = 'item'; isErasing = false; selectedItem = def.id"
                >
                    <img
                        v-for="(src, i) in def.layers"
                        :key="src"
                        :src="src"
                        :style="itemThumbLayerStyle(def.layers.length, i)"
                    />
                    <span v-if="isUserMode" class="palette-item-count" :class="{ 'palette-item-count-empty': availableCount(def.id) <= 0 }">
                        {{ availableCount(def.id) }}/{{ ownedCounts.get(def.id) ?? 0 }}
                    </span>
                </div>
                <div
                    class="palette-tile-btn erase-btn"
                    :class="{ active: placementMode === 'item' && isErasing }"
                    @click="placementMode = 'item'; isErasing = true"
                ><i class="hgi hgi-stroke hgi-eraser"></i></div>
            </div>
            <p v-if="isUserMode && !paletteItems.length" class="palette-hint">
                보유한 맵 아이템이 없어요 — 상점에서 사면 여기 떠요.
            </p>
            <p v-if="isUserMode && paletteItems.some(def => def.crop)" class="palette-hint">
                작물은 방 하나에 최대 {{ MAX_CROPS_PER_MAP }}개까지만 심을 수 있어요(현재 {{ totalCropsPlaced }}/{{ MAX_CROPS_PER_MAP }})
            </p>
            <div class="palette-flip-row">
                <button
                    class="palette-flip-btn select-mode-btn"
                    :class="{ active: placementMode === 'select' }"
                    @click="placementMode = 'select'; deselectItem()"
                ><i class="hgi hgi-stroke hgi-mouse-left-click-01"></i> 아이템 선택</button>
                <button
                    class="palette-flip-btn select-mode-btn"
                    :class="{ active: placementMode === 'spawn' }"
                    @click="placementMode = 'spawn'"
                ><i class="hgi hgi-stroke hgi-flag-02"></i> 스폰 지점</button>
            </div>

            <template v-if="placementMode === 'tile' || placementMode === 'item'">
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

            <!-- 스폰 지점: 유저가 이 방에 처음 들어올 때 서는 위치. 좌표만 있으면 되니 층(z) 선택 +
                 그리드 클릭만으로 충분 -->
            <template v-else-if="placementMode === 'spawn'">
                <div class="palette-hint">스폰 지점으로 쓸 칸을 지도에서 클릭하세요<br>현재: ({{ editSpawn.x }}, {{ editSpawn.y }}) · {{ ['바닥', '1층', '2층'][editSpawn.z] ?? '바닥' }}</div>
                <div class="palette-label">층</div>
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
            <template v-else-if="placementMode === 'select'">
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

            <!-- 맵 전체 배경 — 타일/아이템처럼 지도를 클릭해서 놓는 게 아니라 방 하나에 하나만
                 적용되는 값이라, placementMode와 무관하게 항상 보이는 자리에 따로 둠. 클릭하는
                 즉시(저장 전에도) #wme-container 미리보기에 바로 반영됨(wmeBgStyle 참고) -->
            <div class="palette-label">배경</div>
            <div class="palette-tiles-row">
                <div
                    class="palette-tile-btn"
                    :class="{ active: !editBackground }"
                    title="기본 배경"
                    @click="editBackground = null"
                ><i class="hgi hgi-stroke hgi-image-02"></i></div>
                <div
                    v-for="bg in paletteBackgrounds"
                    :key="bg.itemKey"
                    class="palette-tile-btn"
                    :class="{ active: editBackground === bg.itemKey }"
                    :title="bg.name"
                    @click="editBackground = bg.itemKey"
                >
                    <img :src="bg.icon" />
                </div>
            </div>
            <p v-if="isUserMode && !paletteBackgrounds.length" class="palette-hint">
                보유한 맵 배경이 없어요 — 상점에서 사면 여기 떠요.
            </p>

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
// 채널(방) 맵 편집과 개인 방 맵 편집, 신규 유저 기본 방 템플릿 편집을 하나의 컴포넌트로 통일해서
// 씀 — roomId를 주면 방 맵(관리자 전용, admin/saveRoomMap), userId를 주면 개인 방 맵(saveUserMap),
// defaultTemplate을 true로 주면 관리자가 정하는 "가입 시 기본 방" 템플릿(admin/saveDefaultUserMap,
// 특정 room/user에 안 묶이고 서버 설정 자체에 저장됨)을 편집함. roomId/userId/defaultTemplate 중
// 정확히 하나만 넘길 것 — defaultTemplate은 userId를 안 줘서 관리자 방 모드처럼 팔레트 제한이 없음.
const props = defineProps({
    mapData: { type: String, default: null },
    roomId: { type: Number, default: null },
    userId: { type: Number, default: null },
    defaultTemplate: { type: Boolean, default: false },
})

const emit = defineEmits(['saved', 'cancel'])

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId: currentUserId } = useCurrentUser()
const { ITEM_CATALOG, getItemDef, getItemLayers, getItemFlipBackOffsets } = useItemCatalog()

const isUserMode = computed(() => props.userId != null)

// 개인 방(userId 모드)일 땐 상점에서 산 맵 아이템만 팔레트에 뜨고, 놓을 수 있는 개수도 보유 개수로
// 제한됨 — 방(roomId 모드, 관리자 전용)은 이 제한 없이 카탈로그 전체를 그대로 씀(공용 공간 꾸미는
// 권한이라 개인 지갑이랑 무관해야 함)
// getMyInventory.ts는 body.userid가 아니라 세션으로 "내" 인벤토리를 돌려주는데, SSR 중 평범한
// $fetch로는 그 세션 쿠키가 안 실려서 매번 401 → 빈 배열(보유 아이템 없음)로 보이는 문제가
// 있었음(ServerProfilebar.vue/RoomMap.vue의 같은 문제와 동일) — useRequestFetch()로 고침
const authedFetch = useRequestFetch()
const { data: inventoryData } = await useAsyncData(
    // roomId 모드/다른 userId 사이를 오갈 때 캐시가 섞이지 않도록 키에 대상을 포함시킴
    `map-editor-inventory-${props.userId ?? 'room'}`,
    () => isUserMode.value
        ? authedFetch(`${apiBaseUrl}/api/getMyInventory`, { method: 'POST', body: { userid: props.userId } }).catch(() => [])
        : [],
)
// itemKey(=ITEM_CATALOG/맵 배치에 쓰는 id)를 키로 보유 개수를 모음 — getMyInventory가 돌려주는
// itemid는 items 테이블의 자기 PK라, 레거시 아이템처럼 itemKey랑 다를 수 있어서 itemKey로 다시 매핑함
// category='functional'도 같이 셈 — 농사 작물(밀 등)은 map_item이 아니라 functional로 등록되지만
// 배치 방식(보유 개수만큼만 놓기)은 완전히 동일함(getMapItemCatalog.ts 참고)
const MAP_PLACEABLE_CATEGORIES = new Set(['map_item', 'functional'])
const ownedCounts = computed(() => {
    const map = new Map()
    for (const row of inventoryData.value ?? []) {
        if (!MAP_PLACEABLE_CATEGORIES.has(row.category)) continue
        const id = Number(row.itemKey)
        if (Number.isFinite(id)) map.set(id, row.count)
    }
    return map
})

// 지금 맵에 놓여있는 개수 — 아이템을 놓거나 지울 때마다 editItems가 바뀌면서 자동으로 다시 셈
const placedCounts = computed(() => {
    const map = new Map()
    for (const it of editItems.value) map.set(it.itemid, (map.get(it.itemid) ?? 0) + 1)
    return map
})

// 작물은 종류 상관없이 맵 하나에 최대 이 개수까지만 심을 수 있음(밭 크기 제한 개념) — 서버
// 쪽(saveUserMap.ts)에도 같은 값으로 한 번 더 강제함(값을 바꾸면 두 군데 다 맞출 것)
const MAX_CROPS_PER_MAP = 4
const totalCropsPlaced = computed(() =>
    editItems.value.filter(it => getItemDef(it.itemid)?.crop).length)

// 앞으로 더 놓을 수 있는 개수 — 방 모드는 제한 없음(Infinity). 작물은 보유 개수뿐 아니라
// "맵당 최대 개수" 여유분도 같이 확인해서 더 작은 쪽으로 제한함
function availableCount(id) {
    if (!isUserMode.value) return Infinity
    const ownedAvailable = (ownedCounts.value.get(id) ?? 0) - (placedCounts.value.get(id) ?? 0)
    if (!getItemDef(id)?.crop) return ownedAvailable
    return Math.min(ownedAvailable, MAX_CROPS_PER_MAP - totalCropsPlaced.value)
}

// defaultTemplate 모드(관리자가 꾸미는 "가입 시 기본 방")는 카탈로그 전체가 아니라 '가입 시 기본
// 지급'(items.isDefault) 아이템/지형으로만 팔레트를 제한함 — 그 외 아이템을 여기 놓아두면, 그
// 아이템을 실제로 가진 적 없는 신규 유저가 자기 방을 조금이라도 고쳐 저장하려는 순간
// saveUserMap.ts의 보유 개수 검증에 걸려 저장 자체가 거부돼버림(관리자 눈엔 멀쩡해 보이는데
// 유저는 방을 못 고치는 상황이 됨)
const { data: shopCatalogData } = await useAsyncData(
    // roomId 모드/다른 userId/defaultTemplate 사이를 오갈 때 캐시가 안 섞이게 대상을 키에 포함시킴
    `map-editor-shop-catalog-${props.userId ?? (props.defaultTemplate ? 'default-template' : 'room')}`,
    () => $fetch(`${apiBaseUrl}/api/getShopCatalog`, { method: 'POST', body: { userid: props.userId ?? undefined } })
        .catch(() => []),
)

// 팔레트에 실제로 보여줄 아이템 — 개인 방은 하나라도 가진 것만, defaultTemplate은 기본 지급만,
// 방(관리자, roomId 모드)은 카탈로그 전체
// 작물(def.crop)은 "자기 프로필 개인 홈 맵"에서만 심을 수 있음 — 방(관리자 공용 공간)이나 가입 시
// 기본 템플릿에 심어두면 plantedAt/수확 로직이 애초에 개인 인벤토리 기준이라 앞뒤가 안 맞음
const paletteItems = computed(() => {
    if (props.defaultTemplate) {
        const defaultIds = new Set(
            (shopCatalogData.value ?? [])
                .filter(r => r.category === 'map_item' && r.isDefault)
                .map(r => Number(r.itemKey))
                .filter(Number.isFinite),
        )
        return ITEM_CATALOG.value.filter(def => defaultIds.has(def.id) && !def.crop)
    }
    if (!isUserMode.value) return ITEM_CATALOG.value.filter(def => !def.crop)
    return ITEM_CATALOG.value.filter(def => (ownedCounts.value.get(def.id) ?? 0) > 0)
})

// 지형(타일)도 맵 아이템이랑 같은 원리 — 아바타 기본 파츠처럼 기본 지형 5종도 전부 items 테이블에
// isDefault:true로 등록돼있어서(server/db/seedShopItems.ts) 하드코딩된 목록이 따로 없음. 개인 방은
// 보유한 지형만, defaultTemplate은 기본 지급 지형만, 방(관리자)은 등록된 전체를 팔레트에 보여줌 —
// 그래서 새 기본/특수 지형을 추가하고 싶으면 코드를 안 고치고 관리자 페이지에서 등록하기만 하면 됨.
// 지형은 아바타 파츠처럼 "있다/없다"만 의미가 있어서 개수 배지는 따로 안 둠.
const paletteTileIds = computed(() => {
    const terrainRows = (shopCatalogData.value ?? []).filter(r => r.category === 'terrain')
    return terrainRows
        .filter(r => props.defaultTemplate ? r.isDefault : (isUserMode.value ? r.owned > 0 : true))
        .map(r => Number(r.itemKey))
        .filter(Number.isFinite)
})

// 맵 전체 배경도 지형/맵 아이템과 완전히 같은 원리 — 방(관리자)은 등록된 전체, 개인 방은 보유한
// 것만, defaultTemplate은 기본 지급만 팔레트에 보여줌. terrain과 달리 itemKey가 자유 문자열이라
// Number() 변환 없이 그대로 씀
const paletteBackgrounds = computed(() => {
    const rows = (shopCatalogData.value ?? []).filter(r => r.category === 'map_background')
    return rows
        .filter(r => props.defaultTemplate ? r.isDefault : (isUserMode.value ? r.owned > 0 : true))
        .map(r => ({ itemKey: r.itemKey, name: r.name, icon: r.icon }))
})

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
// useIsoMap.ts 공용 수식 — RoomMap.vue/UserRoomEmbed.vue와 동일
const topRatio = useTopRatioFromZoom(zoomLevel)
const {
    getFilePath, getTileContainerStyle,
    getEditCellStyle: isoGetEditCellStyle, getSpawnMarkerStyle: isoGetSpawnMarkerStyle,
    tileTopSliceStyle, tileTopImgStyle,
    tileSideTopStyle, tileSideTopImgStyle,
    tileSideMiddleContainerStyle, tileSideMiddleImgStyle,
    tileSideBottomStyle, tileSideBottomImgStyle,
} = useIsoTiles(topRatio)

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
const selectedItem = ref(ITEM_CATALOG.value[0]?.id ?? 1)
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

// 스폰 지점 — 유저가 이 방에 처음 들어올 때 서는 좌표. mapInfo(JSON)의 [tiles, items, spawn] 중
// 세 번째 자리에 저장(기존 맵엔 없었으니 없으면 기본값 {x:0,y:0,z:0} — RoomMap.vue가 기존에 쓰던
// 하드코딩 기본값과 동일해서 이 필드가 없는 옛날 맵도 그대로 이전과 똑같이 동작함)
const editSpawn = ref({ x: 0, y: 0, z: 0 })

// 맵 전체 배경 아이템의 itemKey — mapInfo(JSON)의 [tiles, items, spawn, background] 중 네 번째
// 자리에 저장. null이면 useMapBackgroundCatalog.ts가 기본값(public/mapbg.png)으로 풀어줌
const editBackground = ref(null)
const { getMapBackgroundImage } = useMapBackgroundCatalog()
// 저장하기 전에도 지금 고른 배경이 바로 보이도록 라이브 프리뷰(#wme-container에 바인딩)
const wmeBgStyle = computed(() => ({ backgroundImage: `url(${getMapBackgroundImage(editBackground.value)})` }))

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
    if (placementMode.value === 'spawn') {
        editSpawn.value = { x, y, z }
        return
    }
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
        // 작물이면 지금 심는 시각을 찍어둠 — 성장 단계 계산(useItemCatalog.ts getCropGrowth)의
        // 기준점. 작물이 아닌 일반 장식 아이템은 이 필드 자체가 없음(undefined로 두면 JSON에서
        // 그냥 빠짐 — mapInfo에 불필요한 null이 안 쌓임)
        const plantedAt = getItemDef(selectedItem.value)?.crop ? Date.now() : undefined
        if (isErasing.value) {
            if (idx !== -1) editItems.value.splice(idx, 1)
        } else if (idx !== -1) {
            // 이미 있던 칸에 다른 아이템으로 바꿔 놓는 거면(같은 아이템 재배치는 제외) 새로 하나
            // 소모하는 거라 여유분을 확인함 — 기존 것을 빼는 건 항상 자유(제자리로 돌아오는 거니까)
            const replacing = editItems.value[idx].itemid !== selectedItem.value
            if (replacing && availableCount(selectedItem.value) <= 0) return
            editItems.value[idx] = { position: { x, y, z }, itemid: selectedItem.value, flip: selectedFlip.value, flipBack: selectedFlipBack.value, plantedAt }
        } else {
            if (availableCount(selectedItem.value) <= 0) return  // 보유 개수 다 씀 — 인벤토리 반영(개인 방만 제한됨)
            editItems.value.push({ position: { x, y, z }, itemid: selectedItem.value, flip: selectedFlip.value, flipBack: selectedFlipBack.value, plantedAt })
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
        // 스폰 지점/배경은 방/개인 방 둘 다 씀 — 항상 4칸([tiles, items, spawn, background])으로
        // 저장. saveUserMap.ts는 예전에 [tiles] 1칸, [tiles, items] 2칸, [tiles, items, spawn] 3칸
        // 짜리로 저장돼있던 개인 방도 없는 자리를 그냥 기본값으로 채워서 읽으니 하위호환 걱정 없음.
        const mapJson = JSON.stringify([editTiles.value, editItems.value, editSpawn.value, editBackground.value])

        if (props.roomId != null) {
            await $fetch(`${apiBaseUrl}/api/admin/saveRoomMap`, {
                method: 'POST',
                body: { userid: currentUserId.value, id: props.roomId, map: mapJson },
            })
        } else if (props.defaultTemplate) {
            await $fetch(`${apiBaseUrl}/api/admin/saveDefaultUserMap`, {
                method: 'POST',
                body: { userid: currentUserId.value, map: mapJson },
            })
        } else {
            await $fetch(`${apiBaseUrl}/api/saveUserMap`, {
                method: 'POST',
                body: { userid: props.userId ?? currentUserId.value, map: mapJson },
            })
        }
        emit('saved', mapJson)
    } catch {
        alert('저장에 실패했습니다.')
    } finally {
        isSaving.value = false
    }
}

function getEditCellStyle(x, y) {
    return isoGetEditCellStyle(x, y, isErasing.value)
}

// 스폰 지점 마커(깃발) 위치
function getSpawnMarkerStyle() {
    return isoGetSpawnMarkerStyle(editSpawn.value)
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

// useIsoMap.ts 공용 수식(app/composables/useIsoMap.ts) — RoomMap.vue/UserRoomEmbed.vue와 완전히
// 같은 위치/스케일/z-index 계산을 씀. 예전엔 여기 z-index만 n=x+y+2z로 따로 놀아서(4n+k가 아니라)
// 편집 화면과 실제 맵 화면의 깊이 순서가 어긋나는 버그가 있었는데, 공용화하면서 더는 그럴 일이 없음.

onMounted(() => {
    editTiles.value = JSON.parse(JSON.stringify(mapInfo.value?.[0] ?? []))
    editItems.value = JSON.parse(JSON.stringify(mapInfo.value?.[1] ?? []))
    const savedSpawn = mapInfo.value?.[2]
    editSpawn.value = savedSpawn && typeof savedSpawn.x === 'number' && typeof savedSpawn.y === 'number'
        ? { x: savedSpawn.x, y: savedSpawn.y, z: savedSpawn.z ?? 0 }
        : { x: 0, y: 0, z: 0 }
    editBackground.value = mapInfo.value?.[3] ?? null

    // 초기 panY: 그리드 중앙이 화면 중앙에 오도록 계산
    // tile (cx,cy) 중심 screen_y = panY + H/2 + screenY*z  (screenY = (cx+cy)*(dynH/2))
    // 중앙 정렬: panY = -(GRID_SIZE-1)*(dynH/2)*z
    panY.value = -Math.round((GRID_SIZE - 1) * (topRatio.value * 128 / 2) * zoomLevel.value)

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

    // ─── 모바일: 터치 패닝/핀치줌 ───────────────────────────────────────────
    // 데스크톱은 우클릭+드래그로 패닝하는데(onPanStart, e.button===2 체크) 모바일엔 우클릭이
    // 없어서 그 방법 자체가 막혀있었음. 그렇다고 한 손가락 드래그를 곧바로 패닝으로 처리하면
    // 칸을 탭해서 타일을 놓는(handleCellClick) 기존 동작과 부딪히니, 손가락이 일정 거리
    // (TOUCH_DRAG_THRESHOLD) 이상 움직였을 때만 "드래그로 확정"해서 패닝으로 전환하고, 그 이하로만
    // 움직이다 뗐으면 그냥 탭으로 보고 원래 클릭 로직이 그대로 타게 둠(preventDefault 안 함).
    // 드래그로 확정된 뒤 손을 떼면 touchend에서 preventDefault로 뒤이어 나오는 합성 click을
    // 죽여서, 패닝 끝난 자리에 타일이 잘못 찍히는 걸 막음.
    const TOUCH_DRAG_THRESHOLD = 8
    let touchStartPos = null
    let touchLastPos = null
    let touchDragged = false
    let pinchStartDist = null

    function touchDistance(touches) {
        const [a, b] = touches
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    function onWmeTouchStart(e) {
        if (e.target.closest('#wme-palette')) return  // 팔레트 안 터치는 그 자체 스크롤/버튼에 맡김
        if (e.touches.length === 2) {
            pinchStartDist = touchDistance(e.touches)
            touchStartPos = null
            touchLastPos = null
        } else if (e.touches.length === 1) {
            const t = e.touches[0]
            touchStartPos = { x: t.clientX, y: t.clientY }
            touchLastPos = { ...touchStartPos }
            touchDragged = false
            pinchStartDist = null
        }
    }

    function onWmeTouchMove(e) {
        if (e.target.closest('#wme-palette')) return
        if (e.touches.length === 2 && pinchStartDist !== null) {
            e.preventDefault()
            const dist = touchDistance(e.touches)
            const delta = (dist - pinchStartDist) * 0.004
            if (Math.abs(delta) > 0.003) {
                zoomLevel.value = Math.max(0.3, Math.min(2.5, zoomLevel.value + delta))
                pinchStartDist = dist
            }
            return
        }
        if (e.touches.length === 1 && touchLastPos) {
            const t = e.touches[0]
            if (!touchDragged) {
                const totalDist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y)
                if (totalDist < TOUCH_DRAG_THRESHOLD) return  // 아직 탭 범위 — 드래그로 확정 안 함
                touchDragged = true
            }
            e.preventDefault()
            panX.value += t.clientX - touchLastPos.x
            panY.value += t.clientY - touchLastPos.y
            touchLastPos = { x: t.clientX, y: t.clientY }
        }
    }

    function onWmeTouchEnd(e) {
        if (touchDragged) e.preventDefault()  // 방금 패닝이었으면 이어질 합성 click을 죽여서 오타일방지
        touchStartPos = null
        touchLastPos = null
        touchDragged = false
        pinchStartDist = null
    }

    containerRef.value?.addEventListener('touchstart', onWmeTouchStart, { passive: true })
    containerRef.value?.addEventListener('touchmove', onWmeTouchMove, { passive: false })
    containerRef.value?.addEventListener('touchend', onWmeTouchEnd, { passive: false })
    containerRef.value?.addEventListener('touchcancel', onWmeTouchEnd, { passive: true })
})
</script>

<style>
#wme-container {
    position: relative;
    width: 100%;
    /* 이 편집기는 두 군데서 씀: WindowSettings.vue의 관리자 모달(채널 맵 편집, flex column
       부모라 flex:1 1 auto로 남는 공간을 채움)이랑, UserRoomEmbed.vue의 개인 방 꾸미기(고정
       높이 부모라 height:100%로 그 높이를 그대로 채움) — 부모가 flex든 고정 높이든 둘 다
       자연스럽게 맞도록 height:100%와 flex:1 1 auto를 같이 둠(flex 부모가 아니면 flex 속성 자체가
       무시되고 height:100%만 적용됨) */
    height: 100%;
    flex: 1 1 auto;
    min-height: 380px;
    border-radius: 10px;
    overflow: hidden;
    background-color: var(--mapbg, #888);
    /* 실제 이미지는 wmeBgStyle(:style 바인딩, editBackground 라이브 미리보기)에서 결정 — 여기선
       폴백 바탕색과 cover 방식만 고정 */
    background-size: cover;
    background-position: center;
    --char-width: 100%;
    --char-height: 100%;
    user-select: none;
    /* RoomMap.vue의 #map-wrapper와 같은 방식: 기본은 브라우저 네이티브 팬/줌을 허용해두고(그래야
       #wme-palette의 자체 스크롤이 안 깨짐), 실제로 지도 위에서 팬/핀치줌으로 판단되는 제스처만
       JS(onWmeTouchMove)에서 개별적으로 preventDefault해서 가로챔 */
    touch-action: pan-x pan-y;
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

/* 사양 옵션 꺼짐 — 맵 편집기는 CharacterMoving을 렌더하지 않아서(position:fixed 자식 없음)
   RoomMap.vue #map-front와 달리 transform 보존 없이 그냥 꺼도 됨 */
:root[data-reduce-effects="true"] #wme-map-front,
:root[data-reduce-effects="true"] #wme-edit-grid-layer {
    animation: none;
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
    /* 타일/아이템을 상점에서 사면 사는 만큼 팔레트 버튼이 계속 늘어나는데, 폭 제한이 없으면
       한 줄에 다 욱여넣으려고 패널 자체가 옆으로 계속 넓어짐 — 36px 버튼 5개(+간격) 폭으로 고정해서
       그 이상은 아래(.palette-tiles-row의 flex-wrap)로 자연스럽게 줄바꿈되게 함. 딱 맞춘 200px로
       했더니 아래 overflow-y:auto가 스크롤바를 만들 때 그만큼 폭을 갉아먹어서 4개만 들어가길래
       스크롤바 폭(보통 15~17px) 여유분까지 얹어서 넉넉하게 잡음 */
    max-width: 240px;
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

/* 개인 방 모드: 아이템 아이콘 위에 "남은/보유" 개수 배지 */
.palette-item-count {
    position: absolute;
    bottom: 1px;
    right: 2px;
    z-index: 1;
    font-size: 0.55rem;
    font-weight: 700;
    line-height: 1.3;
    color: rgba(255, 255, 255, 0.85);
    background: rgba(0, 0, 0, 0.55);
    border-radius: 4px;
    padding: 0 3px;
    pointer-events: none;
}
.palette-item-count-empty {
    color: #ff6b6b;
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

.spawn-marker {
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: var(--accent, #D21F3C);
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    pointer-events: none;
}

.spawn-marker-icon {
    /* 부모의 -45deg 회전을 반대로 상쇄해서 아이콘 자체는 똑바로 보이게 함 */
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(45deg);
    color: white;
    font-size: 0.72rem;
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

/* 데스크톱에선 숨김 — 아래 미디어쿼리 안에서만 보이게 함. ⚠️ 이 기본 규칙(display:none)은
   반드시 아래 @media 블록보다 CSS 소스상 먼저 와야 함 — 나중에 오면 detail specificity가 같아서
   media query가 매치돼도(display:block) 뒤에 나오는 이 규칙이 그냥 덮어써버려서 모바일에서도
   계속 안 뜨는 버그가 났었음(실제로 겪음). */
#wme-mobile-hint {
    display: none;
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    z-index: 60000;
    background: rgba(20, 20, 28, 0.8);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 7px 10px;
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.72rem;
    text-align: center;
    pointer-events: none;
}

/* 모바일: 팔레트가 데스크톱처럼 우상단에 240px 폭으로 뜨면 좁은 화면 대부분(폭+높이 다)을
   가려서 맵이 거의 안 보임(놓을 자리를 확인할 수가 없음) — 화면 하단에 붙는 바텀시트로 바꿔서
   맵이 위쪽에 계속 보이게 하고, 팔레트는 엄지로 닿기 쉬운 아래쪽에 고정 높이로 둠. 폭 제한을
   풀면 타일/아이템 한 줄에 더 많이 들어가서 내용 자체도 짧아짐. */
@media (max-width: 768px) {
    #wme-palette {
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;
        border-radius: 14px 14px 0 0;
        max-width: none;
        width: 100%;
        max-height: 48%;
        box-sizing: border-box;
    }

    #wme-mobile-hint {
        display: block;
    }
}
</style>
