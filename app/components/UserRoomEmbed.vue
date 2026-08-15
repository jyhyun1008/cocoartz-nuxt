<template>
    <div
        id="ure-container"
        :class="{ 'edit-active': isEditMode }"
        :style="mapBgStyle"
        ref="containerRef"
    >
        <!-- 맵 편집기(WindowMapEditor.vue)는 채널 맵 편집이랑 완전히 같은 컴포넌트를 그대로 씀 —
             userId를 주면 스폰 지점 없이 saveUserMap으로 저장하는 개인 방 모드로 동작함(자세한
             분기는 WindowMapEditor.vue의 hasSpawn 참고). 덕분에 타일뿐 아니라 상점에서 산 맵
             아이템도 개인 방에 그대로 놓을 수 있음 — 예전엔 타일만 되던 부분이 이걸로 해결됨. -->
        <WindowMapEditor
            v-if="isEditMode"
            :map-data="effectiveMapData"
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
                            :layer-opacities="cropGrowthFor(item)?.layerOpacities ?? []"
                            :title="item.title"
                            :link="item.link"
                            interactive
                        />
                        <CharacterMoving
                            :layers="localCharLayers"
                            :back-deco="localChar.backDeco"
                            :front-deco="localChar.frontDeco"
                            :back-hair="localChar.backHair"
                            :top-ratio="topRatio"
                            :zoom-level="zoomLevel"
                            :tile-mode="true"
                            :local-x="localPosition.x"
                            :local-y="localPosition.y"
                            :local-z="charZ"
                            :z-index="charZIndex"
                            :jumping="isJumping"
                        />
                        <!-- 남의 프로필에 놀러왔을 때만: 방 주인 아바타를 스폰 지점 옆(0.5칸 대각선)에
                             가만히 세워둠 — 위 CharacterMoving은 방문자(나) 캐릭터라 방 주인 모습은
                             따로 안 보였음. OtherCharacter는 direction을 안 주면(기본 null) 계속
                             정지 자세라 걷지 않고 그 자리에 서 있기만 함. -->
                        <OtherCharacter
                            v-if="!isOwn"
                            :layers="ownerCharLayers"
                            :back-deco="ownerChar.backDeco"
                            :front-deco="ownerChar.frontDeco"
                            :back-hair="ownerChar.backHair"
                            :top-ratio="topRatio"
                            :local-x="ownerPosition.x"
                            :local-y="ownerPosition.y"
                            :local-z="ownerCharZ"
                            :z-index="ownerCharZIndex"
                            :name="username"
                        />
                    </div>
                </div>
            </div>
        </template>

        <!-- 모바일 전용 이동 조이스틱/점프 버튼 — RoomMap.vue와 같은 방식(4방향 스냅 조이스틱 +
             스페이스바 대응 버튼), 다만 여기는 방 하나짜리 화면이라 controlsBlocked 같은 채팅
             가림 처리는 필요 없음. 편집 중엔 WindowMapEditor가 자기 UI를 따로 그리니 숨김. -->
        <template v-if="!isEditMode">
            <div id="ure-joystick" ref="joystickBase">
                <div id="ure-joystick-knob" :style="joystickKnobStyle"></div>
            </div>
            <div id="ure-jump-btn" ref="jumpBtnRef">
                <span class="ure-jump-btn-bar"></span>
            </div>
        </template>

        <!-- 방 꾸미기 버튼 -->
        <button v-if="isOwn && !isEditMode" id="ure-edit-btn" @click="isEditMode = true">
            {{ t('village.decorateRoom') }}
        </button>

        <!-- 작물 수확 피드백 — RoomMap.vue의 코인 토스트와 같은 방식 -->
        <div v-if="harvestToastAmount !== null" class="ure-harvest-toast">
            +{{ harvestToastAmount }} {{ server?.currencyName ?? t('profilebar.defaultCurrencyName') }}
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    mapData: { type: String, default: null },
    username: { type: String, required: true },
    isOwn: { type: Boolean, default: false },
    ownUserId: { type: Number, default: 0 },
    // 방 주인의 character JSON(useCharacter.ts 형식) — getUserProfile.ts가 내려줌. 남의 프로필에
    // 놀러왔을 때(!isOwn)만 스폰 지점 옆에 세워두는 용도라 내 프로필에선 안 씀
    ownerCharacter: { type: String, default: null },
})

const emit = defineEmits(['map-saved'])

const { t } = useI18n()
const { getItemDef, getItemLayers, getItemFlipBackOffsets } = useItemCatalog()
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

// 이 유저가 자기 방을 한 번도 안 꾸며서 props.mapData가 null이면, 코드에 하드코딩된 6x6 기본 맵
// 대신 관리자가 설정한 "가입 시 기본 방" 템플릿(관리자 설정 > 서버 정보 > 기본 개인 방)을 먼저
// 씀 — 그 템플릿도 없으면 그제서야 buildDefaultMap()으로 감. useServer()는 'server-data' 키로
// 캐시되니 페이지에서 이미 한 번 불러온 서버 데이터를 여기서 다시 fetch하지 않고 그대로 재사용함.
const { server } = await useServer()
const effectiveMapData = computed(() => props.mapData ?? server?.defaultUserMap ?? null)
const { playCoinSound } = useSoundEffects()

// ─── 편집 모드 ────────────────────────────────
// 실제 편집 UI(타일/아이템 배치, 저장)는 전부 WindowMapEditor.vue로 위임함 — 여긴 그 결과를 받아서
// 프로필 페이지 쪽에 그대로 다시 흘려보내는(map-saved) 역할만 함
const isEditMode = ref(false)

function onEditorSaved(mapJson) {
    isEditMode.value = false
    emit('map-saved', mapJson)
}

// ─── 맵/타일 렌더링(둘러보기 전용 — 편집 중엔 WindowMapEditor가 자기 카메라로 따로 그림) ──────
// RoomMap.vue(전체 화면)는 1.0(표준)에서 시작하지만, 여긴 300px짜리 작은 미리보기라 처음부터
// 살짝 줌아웃해서 더 넓게 보이게 함 — 스크롤로 더 줌아웃(0.7까지)/줌인(2.5까지)은 그대로 가능
const zoomLevel = ref(0.8)
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
const joystickBase = ref(null)
const jumpBtnRef = ref(null)
const joystickKnobOffset = ref({ x: 0, y: 0 })
const joystickKnobStyle = computed(() => ({
    transform: `translate(${joystickKnobOffset.value.x}px, ${joystickKnobOffset.value.y}px)`,
}))

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
    if (!effectiveMapData.value) return buildDefaultMap()
    try { return JSON.parse(effectiveMapData.value) } catch { return buildDefaultMap() }
})

const displayTiles = computed(() => mapInfo.value?.[0] ?? [])
// 예전 개인 방 맵은 [tiles] 1칸짜리라 mapInfo[1]이 없을 수 있음 — 그럴 땐 그냥 빈 배열(아이템 없음)
const mapItems = computed(() => mapInfo.value?.[1] ?? [])

// ─── 작물(농사 시스템) 성장/수확 ──────────────────────────
// 심어진 시각(plantedAt)부터 지금까지 지난 시간으로 성장 단계(레이어 불투명도)를 계산함. 시간이
// 흘러야 바뀌는 값이라 30초마다 nowTick만 갱신해서 관련 computed를 다시 돌게 함(초 단위로 딱 맞출
// 필요는 없는 1시간짜리 성장이라 이 정도 해상도면 충분 — 매 프레임/1초 타이머는 낭비).
const nowTick = ref(Date.now())
let growthTimer = null
function cropGrowthFor(item) {
    return getCropGrowth(getItemDef(item.itemid), item.plantedAt, nowTick.value)
}

// 이 아이템을 캐릭터보다 항상 뒤에 그릴지 — (1) 관리자가 등록할 때 "바닥에 까는 아이템"으로
// 표시해둔 경우(러그 등, def.behindAvatar) (2) 작물이 아직 다 안 자란 경우(6번 레이어까지만
// 보이는 낮은 단계 — 다 자라면 원래 깊이 정렬로 되돌아가서 다른 물건들과 정상적으로 앞뒤가 갈림)
function shouldRenderBehindAvatar(item) {
    const def = getItemDef(item.itemid)
    if (def?.behindAvatar) return true
    const growth = cropGrowthFor(item)
    return !!growth && !growth.isFullyGrown
}

// 탭이 백그라운드에 있으면 브라우저가 setInterval을 강하게 스로틀(심하면 아예 멈춤)하기 때문에,
// 다른 탭 보다가 몇십 분 뒤에 돌아와도 growthTimer가 그동안 한 번도 안 돈 채로 멈춰있을 수 있음
// — 그래서 "새로고침해야만 자란 게 보인다"는 문제가 생김. visibilitychange/focus로 탭에 다시
// 돌아온 순간 nowTick을 즉시 갱신하고, 그사이 이미 다 자란 작물이 있으면 서 있는 칸 기준으로
// 수확도 바로 한 번 더 확인함(watch(localPosition)은 "칸이 바뀔 때"만 도니, 같은 칸에 계속
// 서 있다가 배경에서 다 자란 경우는 이걸로 잡아줘야 함)
function catchUpAfterHidden() {
    nowTick.value = Date.now()
    const { tx, ty } = toCollisionTile(localPosition.value.x, localPosition.value.y)
    tryHarvestAt(tx, ty)
}
function handleVisibilityChange() {
    if (!document.hidden) catchUpAfterHidden()
}

// 캐릭터가 실제로 서 있는 칸(toCollisionTile)에 다 자란 작물이 있으면 자동으로 수확함 — 코인
// 수집(RoomMap.vue의 checkCoinCollection)과 같은 "칸이 바뀔 때만 검사" 방식. 본인 방일 때만
// 동작함(tryHarvestAt 맨 위의 !props.isOwn 가드) — 다른 유저 프로필에 놀러왔을 때 방 주인 것까지
// 내가 대신 수확해서 내 인벤토리/재화가 바뀌는 걸 막기 위함(농사는 철저히 자기 인벤토리 기준)
const harvestToastAmount = ref(null)
let harvestToastTimer = null
function showHarvestToast(amount) {
    harvestToastAmount.value = amount
    clearTimeout(harvestToastTimer)
    harvestToastTimer = setTimeout(() => { harvestToastAmount.value = null }, 1500)
}

const harvestingKeys = new Set()
async function tryHarvestAt(tx, ty) {
    if (!props.isOwn) return
    for (const item of mapItems.value) {
        const growth = cropGrowthFor(item)
        if (!growth?.isFullyGrown) continue
        if (item.position.x !== tx || item.position.y !== ty) continue
        const key = `${item.position.x}-${item.position.y}-${item.position.z ?? 0}-${item.itemid}-${item.plantedAt}`
        if (harvestingKeys.has(key)) continue  // 응답 오기 전에 같은 칸을 왔다갔다해도 중복 요청 안 함
        harvestingKeys.add(key)
        try {
            const res = await $fetch(`${apiBaseUrl}/api/harvestCrop`, {
                method: 'POST',
                body: {
                    serverid: server?.id,
                    itemid: item.itemid,
                    position: item.position,
                    plantedAt: item.plantedAt,
                },
            })
            if (res?.ok) {
                showHarvestToast(res.amount)
                playCoinSound()  // 코인 수집(RoomMap.vue)과 같은 재화 획득이라 같은 효과음을 씀
                emit('map-saved', null)  // 맵이 서버에서 바뀌었으니(수확한 작물 제거) 부모가 다시 불러오게 함
            }
        } catch {
            // 실패(이미 수확됨/아직 안 자람 등)는 조용히 무시 — 배지가 이미 사라졌을 수도 있으니
        } finally {
            harvestingKeys.delete(key)
        }
        return  // 한 칸엔 보통 작물 하나 — 찾았으면 더 볼 필요 없음
    }
}
// 개인 방 배경 — RoomMap.vue와 같은 방식(mapInfo[3]을 실제 이미지로 풀어서 #ure-container에 씀)
const { getMapBackgroundImage } = useMapBackgroundCatalog()
const mapBgStyle = computed(() => ({ backgroundImage: `url(${getMapBackgroundImage(mapInfo.value?.[3])})` }))
// 방 주인이 WindowMapEditor.vue에서 지정한 스폰 지점 — [tiles, items] 2칸짜리(스폰 지점 개념
// 추가 전에 저장된 개인 방 맵)까지 하위호환으로 없으면 원점(0,0)으로
const mapSpawn = computed(() => {
    const s = mapInfo.value?.[2]
    return s && typeof s.x === 'number' && typeof s.y === 'number' ? { x: s.x, y: s.y, z: s.z ?? 0 } : { x: 0, y: 0, z: 0 }
})

// ─── 이동 충돌 판정 — RoomMap.vue와 같은 방식(자세한 설명은 그쪽 주석 참고). 여긴 다른 유저/점프가
// 없는 단순 미리보기라 그 부분만 빼고 이식함. 이게 없으면 지형 없는 칸으로도 그냥 걸어나가버림.
// 어떤 지형이 막히는지는 상점(관리자 페이지)에서 지형마다 지정함(useTerrainCatalog.ts 참고)
const { getTerrainBlocksMovement } = useTerrainCatalog()
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
    return !getTerrainBlocksMovement(here.itemid)
}
// 스페이스바로 점프 중일 때만 씀 — 같은 층에서 막혀도 바로 위/아래 층에 유효한(막힘 지형 아닌)
// 타일이 있으면 그쪽으로 넘어갈 수 있게 해줌
function canEnterTileJumping(tx, ty, zCur) {
    if (canEnterTile(tx, ty, zCur)) return true
    const up = tileAt(tx, ty, zCur + 1)
    if (up) return !getTerrainBlocksMovement(up.itemid)
    const down = tileAt(tx, ty, zCur - 1)
    if (down) return !getTerrainBlocksMovement(down.itemid)
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

// 캐릭터가 서 있는 칸이 실제로 바뀔 때만 수확 판정 — RoomMap.vue의 checkCoinCollection과 같은
// "칸 이동 시에만 검사"(제자리 잔이동으로는 중복 트리거 안 됨) 방식
const lastHarvestTile = ref({ x: null, y: null })
watch(localPosition, () => {
    const { tx, ty } = toCollisionTile(localPosition.value.x, localPosition.value.y)
    if (tx === lastHarvestTile.value.x && ty === lastHarvestTile.value.y) return
    lastHarvestTile.value = { x: tx, y: ty }
    tryHarvestAt(tx, ty)
})

const sortedTiles = computed(() => {
    return [...displayTiles.value].sort((a, b) => {
        const az = a.position.z ?? 0
        const bz = b.position.z ?? 0
        return (a.position.x + a.position.y + az * 2) - (b.position.x + b.position.y + bz * 2)
    })
})

// 바닥에 까는 아이템(러그·아직 다 안 자란 작물 등, shouldRenderBehindAvatar) 전용 — 지금 서 있는
// 칸에 그런 아이템이 있으면 그 zIndex를 돌려줌(없으면 null). RoomMap.vue의 getFloorItemZ와 완전히
// 같은 이유/방식(주석 참고) — 캐릭터 쪽 근사식이 아니라 반드시 아이템 쪽의 신뢰할 수 있는 4n+k 값을
// 기준으로 캐릭터를 그 위로 끌어올려야, 캐릭터가 화면 다른 곳에 있을 때의 근사값을 잘못 갖다 써서
// 아이템이 자기 발밑 타일보다도 아래로 눌려 "땅속에 파묻힌" 것처럼 보이는 사고를 피할 수 있음.
function getFloorItemZ(tx, ty, zCur) {
    let max = null
    for (const item of mapItems.value) {
        const iz = item.position.z ?? 0
        if (item.position.x !== tx || item.position.y !== ty || iz !== zCur) continue
        if (!shouldRenderBehindAvatar(item)) continue
        const zIndex = 4 * (item.position.x + item.position.y + 2 * iz) + (iz + 1)
        if (max === null || zIndex > max) max = zIndex
    }
    return max
}

// RoomMap.vue의 getCharZIndex와 같은 스케일(타일의 4n+k와 맞물리는 공식) — 예전엔 옛 타일 z-index
// 스케일(~10000대)에 맞춘 y*-10+9999를 썼는데, 타일이 공용 composable의 4n+k로 바뀌면서 스케일이
// 완전히 어긋나 캐릭터가 항상 맨 위에 뜨는 버그가 됐었음. 여긴 다른 유저/아이템 충돌 판정이 없는
// 단순 미리보기라 RoomMap.vue의 "블로커 아이템" 예외는 없고, 바닥 아이템 예외만 적용함
const charZIndex = computed(() => {
    const { tx, ty } = toCollisionTile(localPosition.value.x, localPosition.value.y)
    const base = -4 * Math.round(localPosition.value.y) + 4 + 4 * charZ.value
    const floorZ = getFloorItemZ(tx, ty, charZ.value)
    return floorZ !== null ? Math.max(base, floorZ + 1) : base
})

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
// ⚠️ onMounted(클라이언트 전용) 안에서 부르던 걸 여기 top-level await로 옮김 — RoomMap.vue와 동일한
// 이유(새로고침할 때마다 옷이 잠깐 기본값으로 보였다가 돌아오던 버그의 원인). SSR도 세션 쿠키를
// 그대로 넘기니(useCurrentUserData.ts) 여기서 기다려도 로그인 판정은 정확함
await ensureUserLoaded()
// 관리자가 상점 페이지에서 업로드한 파츠 스프라이트시트가 있으면 그걸, 없으면 기본 관례 경로를 씀
const { getAvatarPartImage, getDecoLayer } = useAvatarPartCatalog()
// getCharacterLayers가 {layers, backDeco, frontDeco}를 돌려주도록 바뀜(데코가 다른 파츠와 스프라이트
// 치수가 달라서 layers 배열에 안 섞임 — useCharacter.ts 참고)
const localChar = computed(() => getCharacterLayers(currentUserData.value?.character, getAvatarPartImage, getDecoLayer))
const localCharLayers = computed(() => localChar.value.layers)

// 방 주인 아바타(!isOwn일 때만 렌더) — 스폰 지점에서 대각선으로 0.5칸(타일 좌표 기준) 띄워서
// 방문자 스폰 위치랑 겹치지 않게 함. 정지 상태라 topZAt/충돌판정 없이 스폰 지점의 층(z)을 그대로 씀.
// ⚠️ mapSpawn은 타일 좌표라서(useIsoMap.ts의 tileToLocal 주석 참고) 그대로 캐릭터 위치(로컬
// 좌표)에 못 씀 — 오프셋을 타일 좌표 기준으로 먼저 더하고 나서 변환해야 함
const ownerChar = computed(() => getCharacterLayers(props.ownerCharacter, getAvatarPartImage, getDecoLayer))
const ownerCharLayers = computed(() => ownerChar.value.layers)
const ownerPosition = computed(() => tileToLocal(mapSpawn.value.x + 0.5, mapSpawn.value.y - 0.5))
const ownerCharZ = computed(() => mapSpawn.value.z)
const ownerCharZIndex = computed(() => -4 * Math.round(ownerPosition.value.y) + 4 + 4 * ownerCharZ.value)

const position = { x: 0, y: 0 }

// localStorage에서 position 복원 — 저장된 게 없으면(처음 방문이거나 캐시를 지웠으면) 원점(0,0)
// 대신 방 주인이 지정한 스폰 지점에서 시작함.
//
// 예전엔 이걸 watch(..., {immediate:true})로 처리했는데, immediate 콜백은 setup() 단계에서 바로
// 도는 것까지는 맞지만 SSR에서는 그 setup()이 서버(Node)에서도 한 번 실행됨 — 근데 localStorage는
// 브라우저 전용이라 서버에서 참조하면 그 즉시 예외가 나고, try/catch로 감싸놨어도 그 라인에서 바로
// 터지는 거라 if/else 배정 자체가 통째로 스킵됨. 그러면 SSR이 그려서 클라이언트로 보내는 첫 HTML은
// position이 초기값(0,0)인 채로 굳어버리고, 그게 "새로고침하면 항상 스폰(우연히도 기본 스폰이
// 0,0이라 구분이 안 갔음)"처럼 보였던 원인. onMounted는 브라우저에서만(SSR에서는 아예 안) 도는 게
// 보장되니, localStorage를 만지는 로직을 통째로 여기로 옮겨서 이 문제 자체를 없앰.
function restorePosition(username) {
    if (!username) return
    // ⚠️ mapSpawn(스폰 지점)은 타일 좌표라서 캐릭터 위치(로컬 좌표)에 그대로 못 씀 — 반드시
    // tileToLocal로 변환해야 함(localStorage에 저장된 값은 이미 로컬 좌표라 변환이 필요 없음).
    // 예전엔 이 변환이 빠져있어서, 원점이 아닌 자리에 스폰을 찍으면 캐릭터가 그리드랑 동떨어진
    // 엉뚱한 자리에 나타났음(RoomMap.vue의 getSpawnPoint가 이미 겪었던 것과 같은 버그).
    try {
        const stored = localStorage.getItem(`ur-pos-${username}`)
        if (stored) {
            const parsed = JSON.parse(stored)
            position.x = parsed.x ?? 0
            position.y = parsed.y ?? 0
        } else {
            Object.assign(position, tileToLocal(mapSpawn.value.x, mapSpawn.value.y))
        }
    } catch {
        Object.assign(position, tileToLocal(mapSpawn.value.x, mapSpawn.value.y))
    }
    localPosition.value = { ...position }
    charDepth.value = -position.y + 2
    charZ.value = computeCharZ(position.x, position.y)
    updateMapPosition(position)
}

// 프로필 페이지가 다른 유저로 라우팅만 바뀌고(컴포넌트가 재마운트 안 되고) username prop만 바뀌는
// 경우도 커버해야 해서 watch는 그대로 둠 — 다만 첫 진입은 onMounted가 맡으니 immediate는 뺌
watch(() => props.username, restorePosition)

const storageKey = computed(() => `ur-pos-${props.username}`)
const MOVE_KEYS = new Set(['KeyS', 'KeyW', 'KeyA', 'KeyD'])
// 한 스텝당 이동 거리/반복 간격 — RoomMap.vue와 동일(값을 바꾸면 두 군데 다 맞출 것).
// 예전(0.25 / 180ms)이 너무 느리다는 피드백을 받아 걸음이 좀 더 빠르게 느껴지도록 올림.
const MOVES = { KeyS: [0, -0.3], KeyW: [0, 0.3], KeyA: [-0.3, 0], KeyD: [0.3, 0] }
const KEY_REPEAT_MS = 130  // RoomMap.vue와 동일

// CharacterMoving.vue는 실제 keydown/keyup(window)을 직접 리스닝해서 걷기 애니메이션을 재생함.
// 모바일 조이스틱은 키보드가 아니라 터치라 그 이벤트가 안 나서, 애니메이션 트리거용 합성 키
// 이벤트를 쏴서 같은 로직을 그대로 재사용함 — RoomMap.vue와 완전히 같은 방식. isSynthetic
// 플래그로 아래 window keydown/keyup 리스너(실제 이동 처리)가 이걸 다시 처리하지 않게 막음.
function dispatchSyntheticKey(type, code) {
    const ev = new KeyboardEvent(type, { code, bubbles: true })
    ev.isSynthetic = true
    window.dispatchEvent(ev)
}

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
    // 캐릭터 데이터는 이제 위쪽 top-level await로 마운트 전에 이미 로드돼있음
    restorePosition(props.username)  // 브라우저에서만 도는 게 보장되니 여기서 localStorage를 안전하게 읽음

    growthTimer = setInterval(() => { nowTick.value = Date.now() }, 30000)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', catchUpAfterHidden)
    // 처음 들어왔을 때 이미 서 있는 칸에 다 자란 작물이 있을 수도 있으니(예: 다른 탭에서 심고 옴)
    // 마운트 시점에도 한 번 검사해둠 — 이후엔 칸을 옮길 때마다 위 watch(localPosition)가 담당
    const { tx, ty } = toCollisionTile(localPosition.value.x, localPosition.value.y)
    lastHarvestTile.value = { x: tx, y: ty }
    tryHarvestAt(tx, ty)

    window.addEventListener('keydown', (e) => {
        if (e.isSynthetic) return  // 조이스틱/점프 버튼이 걷기 애니메이션만 재생시키려고 쏘는 합성 이벤트 — 이동은 moveStep이 직접 처리하므로 여기선 무시
        if (isEditMode.value) return
        // RoomMap.vue의 onKeydown에는 있는데 여기는 빠져있던 가드 — 프로필 페이지엔 이 방(내 room
        // 미리보기)과 댓글/채팅 입력창이 같이 떠 있는 경우가 많아서, 이 가드 없이는 다른 입력창에
        // 포커스한 채로 스페이스바를 눌러도(예: 댓글에 띄어쓰기) 여기서 먼저 가로채서 점프 처리하고
        // preventDefault까지 걸어버려 스페이스가 안 눌리는 것처럼 보였음("모바일/데스크탑에서 간혹
        // 띄어쓰기가 안 됨" 제보의 원인)
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
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
        if (e.isSynthetic) return
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

    // ─── 모바일 조이스틱/점프 버튼 (RoomMap.vue와 완전히 같은 방식) ──────────────
    const JOY_MAX_RADIUS = 32
    let joyTouchId = null
    let joyCenter = { x: 0, y: 0 }
    let joyActiveDir = null
    let joyInterval = null

    function directionFromDelta(dx, dy) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return null
        return Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'KeyD' : 'KeyA')
            : (dy > 0 ? 'KeyS' : 'KeyW')
    }

    function startJoystickMove(code) {
        dispatchSyntheticKey('keydown', code)
        moveStep(code)
        clearInterval(joyInterval)
        joyInterval = setInterval(() => moveStep(code), KEY_REPEAT_MS)
    }

    function stopJoystickMove(code) {
        clearInterval(joyInterval)
        joyInterval = null
        joystickKnobOffset.value = { x: 0, y: 0 }
        if (code) dispatchSyntheticKey('keyup', code)
    }

    function onJoystickTouchStart(e) {
        e.preventDefault()
        if (isEditMode.value) return
        const touch = e.changedTouches[0]
        joyTouchId = touch.identifier
        const rect = e.currentTarget.getBoundingClientRect()
        joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        joyActiveDir = null
    }

    function onJoystickTouchMove(e) {
        if (joyTouchId === null) return
        const touch = Array.from(e.changedTouches).find(t => t.identifier === joyTouchId)
        if (!touch) return
        e.preventDefault()
        const dx = touch.clientX - joyCenter.x
        const dy = touch.clientY - joyCenter.y
        const dist = Math.min(Math.hypot(dx, dy), JOY_MAX_RADIUS)
        const angle = Math.atan2(dy, dx)
        joystickKnobOffset.value = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }

        const dir = directionFromDelta(dx, dy)
        if (dir !== joyActiveDir) {
            clearInterval(joyInterval)
            joyInterval = null
            if (joyActiveDir) dispatchSyntheticKey('keyup', joyActiveDir)
            joyActiveDir = dir
            if (dir && !isEditMode.value) startJoystickMove(dir)
        }
    }

    function onJoystickTouchEnd(e) {
        if (joyTouchId === null) return
        const touch = Array.from(e.changedTouches).find(t => t.identifier === joyTouchId)
        if (!touch) return
        joyTouchId = null
        const dir = joyActiveDir
        joyActiveDir = null
        stopJoystickMove(dir)
    }

    const joyEl = joystickBase.value
    joyEl?.addEventListener('touchstart', onJoystickTouchStart, { passive: false })
    joyEl?.addEventListener('touchmove', onJoystickTouchMove, { passive: false })
    joyEl?.addEventListener('touchend', onJoystickTouchEnd, { passive: true })
    joyEl?.addEventListener('touchcancel', onJoystickTouchEnd, { passive: true })

    // 모바일 점프 버튼 — 스페이스바 keydown/keyup과 완전히 같은 jumpHeld/triggerJumpAnim을 그대로 씀
    function onJumpBtnTouchStart(e) {
        e.preventDefault()
        if (isEditMode.value) return
        jumpHeld = true
        triggerJumpAnim()
    }
    function onJumpBtnTouchEnd() {
        jumpHeld = false
    }
    const jumpBtnEl = jumpBtnRef.value
    jumpBtnEl?.addEventListener('touchstart', onJumpBtnTouchStart, { passive: false })
    jumpBtnEl?.addEventListener('touchend', onJumpBtnTouchEnd, { passive: true })
    jumpBtnEl?.addEventListener('touchcancel', onJumpBtnTouchEnd, { passive: true })
})

onUnmounted(() => {
    clearInterval(growthTimer)
    clearTimeout(harvestToastTimer)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', catchUpAfterHidden)
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
    /* 실제 이미지는 mapBgStyle(:style 바인딩)에서 결정 — 여기선 폴백 바탕색과 cover 방식만 고정 */
    background-size: cover;
    background-position: center;
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

/* 방 꾸미기 버튼 — z-index가 60000이나 되던 바람에, 프로필 페이지 상단에 고정된 헤더바
   (@[username].vue의 #profile-nav, z-index:9999)보다도 앞에 떠서 스크롤 시 헤더 위로
   button이 삐져나와 보이는 문제가 있었음. 이 임베드 안의 다른 오버레이(조이스틱/점프 버튼,
   z-index:200)보다만 앞에 있으면 되므로 훨씬 작은 값으로 낮춤 */
#ure-edit-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 300;
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

/* 모바일 전용 이동 조이스틱/점프 버튼 — RoomMap.vue의 #mobile-joystick/#mobile-jump-btn과 같은
   방식이지만, 여긴 전체화면이 아니라 카드 안에 박힌 작은 뷰라 크기를 좀 줄이고 위치도
   #ure-container 기준 absolute로 둠(부모가 이미 position:relative). 기본은 숨겨두고 터치
   화면에서만 노출함. */
#ure-joystick {
    display: none;
    position: absolute;
    left: 10px;
    bottom: 10px;
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(20, 20, 28, 0.55);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    z-index: 200;
    touch-action: none;
}

#ure-joystick-knob {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 38px;
    height: 38px;
    margin: -19px 0 0 -19px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.55);
    transition: transform 0.05s linear;
}

#ure-jump-btn {
    display: none;
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(20, 20, 28, 0.55);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    z-index: 200;
    touch-action: none;
    align-items: center;
    justify-content: center;
}

#ure-jump-btn:active {
    background: rgba(255, 255, 255, 0.15);
}

.ure-jump-btn-bar {
    display: block;
    width: 28px;
    height: 10px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.55);
}

/* 작물 수확 토스트 — RoomMap.vue의 #coin-toast와 같은 연출(작은 임베드 안이라 top%만 조정) */
.ure-harvest-toast {
    position: absolute;
    left: 50%;
    top: 14px;
    transform: translateX(-50%);
    background: linear-gradient(145deg, #ffe17d, #f4b400);
    color: #7a4a00;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.85rem;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    white-space: nowrap;
    pointer-events: none;
    z-index: 400;
    animation: ure-harvest-toast-fade 1.5s ease forwards;
}

@keyframes ure-harvest-toast-fade {
    0% { opacity: 0; transform: translateX(-50%) translateY(6px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
}

@media (max-width: 768px) {
    /* 방보다 화면(손가락)이 작으니, 조이스틱/점프 버튼 놓을 자리가 생기게 세로로 좀 키움 */
    #ure-container:not(.edit-active) {
        height: 420px;
        --char-height: 420px;
    }

    #ure-joystick {
        display: block;
    }

    #ure-jump-btn {
        display: flex;
    }

    /* 조이스틱/점프 버튼이 하단을 차지하니, 방 꾸미기 버튼은 겹치지 않게 위쪽으로 옮김 */
    #ure-edit-btn {
        top: 10px;
        right: 10px;
        bottom: auto;
    }
}
</style>
