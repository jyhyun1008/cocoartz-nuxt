<template>
    <div
        id="ure-container"
        :class="{ 'edit-active': isEditMode }"
        ref="containerRef"
    >
        <!-- 맵 편집기(WindowMapEditor.vue)는 채널 맵 편집이랑 완전히 같은 컴포넌트를 그대로 씀 —
             userId를 주면 스폰 지점 없이 saveUserMap으로 저장하는 개인 방 모드로 동작함(자세한
             분기는 WindowMapEditor.vue의 hasSpawn 참고). 덕분에 타일뿐 아니라 상점에서 산 맵
             아이템도 개인 방에 그대로 놓을 수 있음 — 예전엔 타일만 되던 부분이 이걸로 해결됨. -->
        <WindowMapEditor
            v-if="isEditMode"
            :map-data="props.mapData"
            :user-id="props.ownUserId"
            @saved="onEditorSaved"
            @cancel="isEditMode = false"
        />

        <template v-else>
            <!-- 통합 레이어: 타일(z 무관) + 아이템 + 캐릭터를 전부 같은 스태킹 컨텍스트에서 z-index
                 하나로 깊이 결정. 예전엔 z=0/z≥1을 #ure-map/#ure-map-front 두 개로 쪼개서 렌더했는데,
                 이 둘이 서로 다른(뒤/앞 고정) 스태킹 컨텍스트라 z≥1 쪽(아이템·캐릭터 포함)이 내부
                 z-index값과 무관하게 항상 z=0 쪽 위에 그려졌음 — RoomMap.vue/WindowMapEditor.vue는
                 이미 이렇게 통합해서 고쳐뒀던 걸 여기도 맞춤. -->
            <div id="ure-map-front">
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
                            <div class="tile-slice" :style="tileSideMiddleContainerStyle(tile)">
                                <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideMiddleImgStyle(tile)" />
                            </div>
                            <div class="tile-slice" :style="tileSideBottomStyle">
                                <NuxtImg :src="getFilePath(tile)" class="tile-img-full" :style="tileSideBottomImgStyle" />
                            </div>
                        </div>
                        <MapItem
                            v-for="(item, idx) in mapItems"
                            :key="`item-${item.position.x}-${item.position.y}-${item.position.z ?? 0}-${idx}`"
                            :layers="getItemLayers(item.itemid)"
                            :position="item.position"
                            :top-ratio="topRatio"
                            :blur-px="getDepthBlur(item.position.x + item.position.y)"
                            :flip-x="!!item.flip"
                            :flip-back="!!item.flipBack"
                            :flip-back-offsets="getItemFlipBackOffsets(item.itemid)"
                            :title="item.title"
                            :link="item.link"
                            interactive
                        />
                        <CharacterMoving
                            :layers="localCharLayers"
                            :top-ratio="topRatio"
                            :zoom-level="zoomLevel"
                            :tile-mode="true"
                            :local-x="localPosition.x"
                            :local-y="localPosition.y"
                            :local-z="charZ"
                            :z-index="charZIndex"
                            :jumping="isJumping"
                        />
                    </div>
                </div>
            </div>
        </template>

        <!-- 방 꾸미기 버튼 -->
        <button v-if="isOwn && !isEditMode" id="ure-edit-btn" @click="isEditMode = true">
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

const { getItemLayers, getItemFlipBackOffsets } = useItemCatalog()

// ─── 편집 모드 ────────────────────────────────
// 실제 편집 UI(타일/아이템 배치, 저장)는 전부 WindowMapEditor.vue로 위임함 — 여긴 그 결과를 받아서
// 프로필 페이지 쪽에 그대로 다시 흘려보내는(map-saved) 역할만 함
const isEditMode = ref(false)

function onEditorSaved(mapJson) {
    isEditMode.value = false
    emit('map-saved', mapJson)
}

// ─── 맵/타일 렌더링(둘러보기 전용 — 편집 중엔 WindowMapEditor가 자기 카메라로 따로 그림) ──────
const zoomLevel = ref(1)
// useIsoMap.ts 공용 수식 — RoomMap.vue/WindowMapEditor.vue와 동일
const topRatio = useTopRatioFromZoom(zoomLevel)
const {
    getFilePath,
    getTileContainerStyle: getIsoTileContainerStyle,
    tileTopSliceStyle, tileTopImgStyle,
    tileSideTopStyle, tileSideTopImgStyle,
    tileSideMiddleContainerStyle, tileSideMiddleImgStyle,
    tileSideBottomStyle, tileSideBottomImgStyle,
} = useIsoTiles(topRatio)

const localPosition = ref({ x: 0, y: 0 })
const mapLeft = ref(0)
const mapTop = ref(0)
const charDepth = ref(0)
// 지금 캐릭터가 서 있는 층 — 타일/아이템의 z와 같은 오프셋으로 CharacterMoving에 넘겨서 높은
// 지형(예: 기본 맵의 z=1 단상) 위에 서면 그만큼 떠 보이게 함
const charZ = ref(0)
// 스페이스바 점프 연출 트리거 — RoomMap.vue와 같은 방식(자세한 설명은 그쪽 주석 참고)
const isJumping = ref(false)
const containerRef = ref(null)

// 피사계심도(초점 흐림) — RoomMap.vue와 같은 방식(캐릭터가 있는 깊이에서 멀어질수록 흐려짐).
// 타일/아이템 둘 다 적용 — 원래 있던 걸 공용 composable로 옮기면서 실수로 타일 쪽만 빠뜨렸었음
function getDepthBlur(depth) {
    const depthDiff = Math.abs(depth - charDepth.value)
    return Number((Math.min(depthDiff * 1.2, 6) / Math.max(zoomLevel.value, 1)).toFixed(1))
}

// 공용 위치/스케일/z-index(getIsoTileContainerStyle) 위에 이 화면 전용 blur만 얹음
function getTileContainerStyle(tile) {
    const { x, y } = tile.position
    const blur = getDepthBlur(x + y)
    return {
        ...getIsoTileContainerStyle(tile),
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
    }
}

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

const displayTiles = computed(() => mapInfo.value?.[0] ?? [])
// 예전 개인 방 맵은 [tiles] 1칸짜리라 mapInfo[1]이 없을 수 있음 — 그럴 땐 그냥 빈 배열(아이템 없음)
const mapItems = computed(() => mapInfo.value?.[1] ?? [])

// ─── 이동 충돌 판정 — RoomMap.vue와 같은 방식(자세한 설명은 그쪽 주석 참고). 여긴 다른 유저/점프가
// 없는 단순 미리보기라 그 부분만 빼고 이식함. 이게 없으면 지형 없는 칸으로도 그냥 걸어나가버림.
const WATER_TILE_ID = 2
function tilesAt(tx, ty) {
    return displayTiles.value.filter(t => t.position.x === tx && t.position.y === ty)
}
function tileAt(tx, ty, z) {
    return tilesAt(tx, ty).find(t => (t.position.z ?? 0) === z) ?? null
}
function topZAt(tx, ty) {
    const ts = tilesAt(tx, ty)
    if (!ts.length) return null
    return Math.max(...ts.map(t => t.position.z ?? 0))
}
function canEnterTile(tx, ty, zCur) {
    const here = tileAt(tx, ty, zCur)
    if (!here) return false
    if (tileAt(tx, ty, zCur + 1)) return false
    return here.itemid !== WATER_TILE_ID
}
// 스페이스바로 점프 중일 때만 씀 — 같은 층에서 막혀도 바로 위/아래 층에 유효한(물 아닌) 타일이
// 있으면 그쪽으로 넘어갈 수 있게 해줌
function canEnterTileJumping(tx, ty, zCur) {
    if (canEnterTile(tx, ty, zCur)) return true
    const up = tileAt(tx, ty, zCur + 1)
    if (up) return up.itemid !== WATER_TILE_ID
    const down = tileAt(tx, ty, zCur - 1)
    if (down) return down.itemid !== WATER_TILE_ID
    return false
}
const COLLISION_Y_OFFSET = -1
function toCollisionTile(px, py) {
    const effY = py + COLLISION_Y_OFFSET
    return {
        tx: Math.round(px / 4 - effY / 2),
        ty: Math.round(-effY / 2 - px / 4),
    }
}
function computeCharZ(px, py) {
    const { tx, ty } = toCollisionTile(px, py)
    return topZAt(tx, ty) ?? 0
}

const sortedTiles = computed(() => {
    return [...displayTiles.value].sort((a, b) => {
        const az = a.position.z ?? 0
        const bz = b.position.z ?? 0
        return (a.position.x + a.position.y + az * 2) - (b.position.x + b.position.y + bz * 2)
    })
})

// RoomMap.vue의 getCharZIndex와 같은 스케일(타일의 4n+k와 맞물리는 공식) — 예전엔 옛 타일 z-index
// 스케일(~10000대)에 맞춘 y*-10+9999를 썼는데, 타일이 공용 composable의 4n+k로 바뀌면서 스케일이
// 완전히 어긋나 캐릭터가 항상 맨 위에 뜨는 버그가 됐었음. 여긴 다른 유저/아이템 충돌 판정이 없는
// 단순 미리보기라 RoomMap.vue의 "블로커 아이템" 예외 없이 기본 공식만 씀
const charZIndex = computed(() => -4 * Math.round(localPosition.value.y) + 4 + 4 * charZ.value)

const tilesScaleStyle = computed(() => {
    const ox = localPosition.value.x * 32
    const oy = -localPosition.value.y * topRatio.value * 64
    return {
        transform: `scale(${zoomLevel.value})`,
        transformOrigin: `calc(50% + ${ox}px) calc(50% + ${oy}px)`,
    }
})

// 패닝용 position (WASD 전용 — RoomMap.vue의 일반 방 화면도 드래그 패닝은 없고 WASD만 지원해서
// 통일했음. 예전엔 여기만 우클릭 드래그로도 맵을 움직일 수 있었는데, 그러면서 캐릭터가 실제
// 서 있는 자리랑 화면에 보이는 자리가 어긋나 보이는 문제가 있었음)
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
    charZ.value = computeCharZ(position.x, position.y)
    updateMapPosition(position)
}, { immediate: true })

const storageKey = computed(() => `ur-pos-${props.username}`)
const MOVE_KEYS = new Set(['KeyS', 'KeyW', 'KeyA', 'KeyD'])
const MOVES = { KeyS: [0, -0.25], KeyW: [0, 0.25], KeyA: [-0.25, 0], KeyD: [0.25, 0] }
const KEY_REPEAT_MS = 180  // RoomMap.vue와 동일

// 스페이스바 점프 — 누르고 있는 동안(jumpHeld)은 방향키로 이동할 때 층이 달라지는 칸도
// 허용됨(canEnterTileJumping). RoomMap.vue와 같은 방식.
let jumpHeld = false
let jumpAnimTimer = null
function triggerJumpAnim() {
    // true→true로 다시 대입하면 Vue가 변화 없음으로 보고 클래스를 안 건드려서 CSS 애니메이션이
    // 재시작 안 됨 — 한 틱 false로 껐다가 다음 틱에 다시 true로 켜서 강제로 재생함
    isJumping.value = false
    nextTick(() => { isJumping.value = true })
    clearTimeout(jumpAnimTimer)
    jumpAnimTimer = setTimeout(() => { isJumping.value = false }, 400)
}

function moveStep(code) {
    const delta = MOVES[code]
    if (!delta) return
    const newX = position.x + delta[0]
    const newY = position.y + delta[1]

    // 실제로 칸(타일)이 바뀌는 이동일 때만 충돌 검사 — RoomMap.vue의 moveStep과 같은 방식
    const { tx: curTx, ty: curTy } = toCollisionTile(position.x, position.y)
    const { tx: newTx, ty: newTy } = toCollisionTile(newX, newY)
    if (curTx !== newTx || curTy !== newTy) {
        const zCur = topZAt(curTx, curTy) ?? 0
        const canEnter = jumpHeld ? canEnterTileJumping(newTx, newTy, zCur) : canEnterTile(newTx, newTy, zCur)
        if (!canEnter) return  // 지형 없음/물 블록/낮은 천장(점프 중 아니면 층이 달라도) — 이동 취소
        if (jumpHeld) triggerJumpAnim()  // 점프 중 실제로 한 칸 넘어갈 때마다 다시 튀는 연출 재생
        charZ.value = topZAt(newTx, newTy) ?? 0
    }

    position.x = newX
    position.y = newY
    localPosition.value = { ...position }
    charDepth.value = -position.y + 2
    updateMapPosition(position)
    localStorage.setItem(storageKey.value, JSON.stringify(position))
}

// 방향키를 브라우저 자체 auto-repeat에 맡기지 않고 직접 setInterval로 반복시킴 — 방향키를 먼저
// 누른 채로 스페이스바를 나중에 누르면(또는 그 반대) 일부 브라우저는 "마지막으로 누른 키만"
// auto-repeat를 계속하고 먼저 누르고 있던 키의 repeat가 멈춰버리는 경우가 있어서, 방향키+스페이스바를
// 어떤 순서로 누르든 계속 같이 눌려있는 걸로 인식되게 함(RoomMap.vue와 완전히 같은 방식)
const heldMoveKeys = []
let moveRepeatInterval = null
function startMoveRepeat() {
    if (moveRepeatInterval) return
    moveRepeatInterval = setInterval(() => {
        const code = heldMoveKeys[heldMoveKeys.length - 1]
        if (code) moveStep(code)
    }, KEY_REPEAT_MS)
}
function stopMoveRepeatIfEmpty() {
    if (heldMoveKeys.length > 0) return
    clearInterval(moveRepeatInterval)
    moveRepeatInterval = null
}

onMounted(() => {
    ensureUserLoaded()

    window.addEventListener('keydown', (e) => {
        if (isEditMode.value) return
        if (e.code === 'Space') {
            e.preventDefault()  // 안 막으면 브라우저 기본 동작(페이지 스크롤)이 먹음
            if (!e.repeat) {
                jumpHeld = true
                triggerJumpAnim()
            }
            return
        }
        if (!MOVES[e.code] || e.repeat) return  // 반복은 moveRepeatInterval이 전담 — 브라우저 자체 auto-repeat는 무시
        moveStep(e.code)
        if (!heldMoveKeys.includes(e.code)) heldMoveKeys.push(e.code)
        startMoveRepeat()
    })

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') { jumpHeld = false; return }
        if (!MOVE_KEYS.has(e.code)) return
        const idx = heldMoveKeys.indexOf(e.code)
        if (idx !== -1) heldMoveKeys.splice(idx, 1)
        stopMoveRepeatIfEmpty()
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
