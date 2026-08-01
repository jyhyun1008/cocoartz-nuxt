<template>
    <div id="userroom-wrapper" ref="wrapperRef">
        <!-- z=0 타일 레이어 -->
        <div id="userroom-map" :style="mapStyle">
            <div v-if="mapInfo && mapInfo[0]" class="maptiles1" :style="tilesScaleStyle">
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
        <div id="userroom-map-front">
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
                        character="/character/sample/1.png"
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

        <div id="ur-profile-card">
            <div class="ur-avatar-wrap">
                <NuxtImg v-if="props.user.avatar" :src="props.user.avatar" class="avatar" />
                <div v-else class="avatar avatar-placeholder ur-avatar-initial">
                    {{ (props.user.knownas ?? props.user.username)[0] }}
                </div>
            </div>
            <div class="ur-info">
                <div class="ur-knownas">{{ props.user.knownas ?? props.user.username }}</div>
                <div class="ur-username">@{{ props.user.username }}</div>
                <div v-if="props.user.bio" class="ur-bio">{{ props.user.bio }}</div>
            </div>
            <button v-if="isOwn" class="ur-edit-btn">방 꾸미기</button>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    user: { type: Object, required: true },
    ownUserId: { type: Number, default: 0 },
})

const isOwn = computed(() => props.ownUserId === props.user.id)

const TILE_W = 128
const TILE_IMG_H = 128

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
const wrapperRef = ref(null)

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
    if (!props.user.map) return buildDefaultMap()
    try { return JSON.parse(props.user.map) } catch { return buildDefaultMap() }
})

const sortedTiles = computed(() => {
    if (!mapInfo.value?.[0]) return []
    return [...mapInfo.value[0]].sort((a, b) => {
        const az = a.position.z ?? 0
        const bz = b.position.z ?? 0
        return (a.position.x + a.position.y + az * 2) - (b.position.x + b.position.y + bz * 2)
    })
})

const tilesBack = computed(() =>
    sortedTiles.value.filter(t => (t.position.z ?? 0) === 0)
)
const tilesFront = computed(() =>
    sortedTiles.value.filter(t => (t.position.z ?? 0) >= 1)
)

const charZIndex = computed(() =>
    (localPosition.value.y) * -10 + 9999
)

function getFilePath(tile) {
    return `/tileset/${tile.itemid}.png`
}

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
        filter: Number(blur) > 0 ? `blur(${blur}px)` : undefined,
        zIndex: (x + y) * 10 + z * 2 + 10000,
    }
}

const tileTopSliceStyle = computed(() => ({
    height: `${topRatio.value * TILE_IMG_H}px`,
}))
const tileTopImgStyle = computed(() => ({
    width: '128px',
    height: `${TILE_IMG_H * 2 * topRatio.value}px`,
}))

const tileSideTopStyle = computed(() => ({
    height: `${topRatio.value * TILE_IMG_H / 4}px`,
}))
const tileSideTopImgStyle = computed(() => ({
    width: '128px',
    height: `${TILE_IMG_H * 2 * topRatio.value}px`,
    marginTop: `${-TILE_IMG_H * topRatio.value}px`,
}))

function tileSideMiddleContainerStyle(tile) {
    const S = (1 - topRatio.value) * TILE_IMG_H
    return { height: `${S / 2}px` }
}
function tileSideMiddleImgStyle(tile) {
    const S = (1 - topRatio.value) * TILE_IMG_H
    const sf = 2
    return {
        width: '128px',
        height: `${2 * S * sf}px`,
        marginTop: `${-5 * S / 4 * sf}px`,
    }
}

const tileSideBottomStyle = computed(() => ({
    height: `${topRatio.value * TILE_IMG_H / 2}px`,
}))
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

const storageKey = computed(() => `ur-pos-${props.user.username}`)

onMounted(() => {
    let position = { x: 0, y: 0 }
    try {
        const stored = localStorage.getItem(storageKey.value)
        if (stored) {
            const parsed = JSON.parse(stored)
            position = { x: parsed.x ?? 0, y: parsed.y ?? 0 }
        }
    } catch {}
    localPosition.value = position
    charDepth.value = -position.y + 2
    updateMapPosition(position)

    window.addEventListener('keydown', (e) => {
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

    wrapperRef.value?.addEventListener('wheel', (e) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        zoomLevel.value = Math.max(0.7, Math.min(2.5, zoomLevel.value + delta))
        updateMapPosition(position)
    }, { passive: false })
})
</script>

<style>
#userroom-wrapper {
    width: 100vw;
    height: calc(100dvh - 3rem);
    position: fixed;
    bottom: 0;
    left: 0;
    overflow: hidden;
    background-color: var(--mapbg, #888);
    --char-width: 100vw;
    --char-height: calc(100dvh - 3rem);
}

#userroom-map {
    width: 100%;
    height: 100%;
    position: relative;
    animation: handheld 9s ease-in-out infinite;
}

#userroom-map-front {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    animation: handheld 9s ease-in-out infinite;
}

#ur-profile-card {
    position: absolute;
    bottom: 14px;
    left: 14px;
    z-index: 99;
    width: 220px;
    background: rgba(26,26,34,0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px;
    padding: 16px;
    color: rgba(255,255,255,0.85);
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.ur-avatar-initial {
    width: 56px !important;
    height: 56px !important;
    font-size: 1.6rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bgaccent, #D21F3C22);
    border: 2px solid var(--accent, #D21F3C);
    color: var(--accent, #D21F3C);
}

.ur-avatar-wrap .avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    flex-shrink: 0;
}

.ur-info { display: flex; flex-direction: column; gap: 2px; }
.ur-knownas { font-weight: 700; font-size: 1.05rem; line-height: 1.3; }
.ur-username { font-size: 0.82rem; color: rgba(255,255,255,0.45); }
.ur-bio { font-size: 0.88rem; color: rgba(255,255,255,0.6); line-height: 1.5; margin-top: 4px; white-space: pre-wrap; }

.ur-edit-btn {
    background: var(--accent, #D21F3C);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    align-self: flex-start;
    transition: opacity 0.15s;
}
.ur-edit-btn:hover { opacity: 0.85; }
</style>
