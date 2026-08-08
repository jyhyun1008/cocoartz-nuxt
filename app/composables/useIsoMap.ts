// 이 프로젝트의 모든 맵 화면(RoomMap.vue=기본 맵, UserRoomEmbed.vue=개인 방, WindowMapEditor.vue=
// 맵 편집기)이 공유하는 아이소메트릭 타일 스태킹 수식. 예전엔 세 군데에 거의 통째로 복붙돼있었는데
// (그중 UserRoomEmbed.vue는 z-index 스케일까지 따로 놀아서, 나중에 아이템을 얹으면 타일과 깊이
// 순서가 어긋나는 버그가 날 뻔했음), 지금은 여기 하나로 모아서 세 군데가 전부 같은 코드를 씀 —
// 여기 값을 바꾸면 세 화면이 동시에 바뀜.
export const TILE_W = 128
export const TILE_IMG_H = 128

// 줌 레벨(0.3~2.5 정도) → topRatio(1/3~0.9, 타일이 "위에서 내려다보는" 정도). 값 자체는 여러 튜닝을
// 거친 결과라 그대로 유지 — 줌인할수록 topRatio가 작아져서(=옆면이 더 보여서) 정면에 가까워지고,
// 줌아웃할수록 topRatio가 커져서(=윗면이 더 보여서) 위에서 내려다보는 것에 가까워짐
export function useTopRatioFromZoom(zoomLevel) {
    return computed(() => {
        const z = zoomLevel.value
        const raw = z >= 1.0 ? 0.5 - (z - 1.0) / 9 : 0.5 + (1.0 - z) * 0.28
        return Math.max(1 / 3, Math.min(0.9, raw))
    })
}

// topRatio(보통 computed ref)를 받아서 그 값에 맞는 타일 렌더링 스타일 함수/computed 묶음을 돌려줌.
// 컴포넌트마다 한 번씩만 호출해서 쓸 것 — 내부 computed들이 넘겨준 topRatio를 그대로 추적함.
export function useIsoTiles(topRatio) {
    // getFilePath는 여기(useIsoTiles 내부)에서만 선언함 — composables/ 안의 top-level export는
    // Nuxt가 이름 그대로 전역 auto-import 대상으로 잡는데, 그러면 각 컴포넌트에서
    // `const { getFilePath } = useIsoTiles(topRatio)`로 로컬 구조분해할 때 auto-import가 주입한
    // 동명의 import랑 부딪혀서 "Identifier 'getFilePath' has already been declared" 컴파일 에러가 남.
    // useIsoTiles()가 돌려주는 객체 프로퍼티로만 노출해서 그 문제를 피함.
    // 실제 타일 이미지는 지형 카탈로그(useTerrainCatalog.ts)에서 가져옴 — 관리자가 상점 페이지에서
    // 올린 이미지(items.icon)를 그대로 씀. 카탈로그에 없는 itemid(오래된 맵 등)는 예전 그대로
    // `/tileset/N.png` 관례로 폴백함(getTerrainImage 내부에서 처리).
    const { getTerrainImage } = useTerrainCatalog()
    function getFilePath(tile) {
        return getTerrainImage(tile.itemid)
    }

    // 타일 컨테이너 위치/스케일/깊이(z-index) — 캐릭터·아이템(MapItem.vue의 defaultZIndex)과
    // 반드시 같은 "4n+k" 스케일을 써야 함(n=x+y, k=z). 다른 스케일을 쓰면 같은 화면 깊이에 있는
    // 타일/아이템/캐릭터끼리 가려지는 순서가 뒤섞임 — 예전에 이것 때문에 겪은 버그가 있어서
    // (WindowMapEditor.vue 히스토리 참고) 스케일 자체를 여기 하나로 고정해둠.
    function getTileContainerStyle(tile) {
        const { x, y, z = 0 } = tile.position
        // 렌더된 top face 높이 = topRatio * TILE_IMG_H, isometric에서 step = top face 높이의 절반
        const dynH = TILE_IMG_H * topRatio.value
        const S = (1 - topRatio.value) * TILE_IMG_H
        // elevation = 렌더된 side 높이 (dynH/4 + S/2 + dynH/2) → z=1 바닥이 z=0 앞모서리에 정렬
        const sideH = dynH * 3 / 4 + S / 2
        const screenX = (x - y) * (TILE_W / 2)
        const screenY = (x + y) * (dynH / 2) - z * sideH
        const scale = (1 + (x + y) * 0.004).toFixed(3)
        const n = x + y
        const k = z
        return {
            left: `calc(50% + ${screenX - TILE_W / 2}px)`,
            top: `calc(50% + ${screenY - dynH / 2}px)`,
            transform: `scale(${scale})`,
            zIndex: 4 * n + k,
        }
    }

    // 타일 분할: 상단(바닥면) / 하단(옆면) 3분할(25/25/50) — 각 슬라이스 안에서 이미지를 실제로
    // 스케일링해서 topRatio에 따른 비율 변화를 시각적으로 표현함
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

    // 편집 그리드 칸 하나의 클릭 히트박스(마름모) — 맵 편집기류에서만 씀
    function getEditCellStyle(x, y, isErasing = false) {
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
            cursor: isErasing ? 'cell' : 'crosshair',
            zIndex: 50000,
        }
    }

    // 스폰 지점 마커(깃발) 위치 — getTileContainerStyle과 같은 좌표 변환식 재사용. 방(room) 맵
    // 편집기에서만 씀(개인 방은 스폰 개념이 없음)
    function getSpawnMarkerStyle(spawn) {
        const { x, y, z = 0 } = spawn
        const dynH = TILE_IMG_H * topRatio.value
        const S = (1 - topRatio.value) * TILE_IMG_H
        const sideH = dynH * 3 / 4 + S / 2
        const screenX = (x - y) * (TILE_W / 2)
        const screenY = (x + y) * (dynH / 2) - z * sideH
        // 핀의 뾰족한 끝이 타일 중심에 딱 닿도록: .spawn-marker는 정사각형을 45도 돌려 만든
        // 물방울 모양이라, 뾰족한 끝은 박스 중심에서 half*√2만큼 아래에 있음
        const half = 11
        const tipDrop = half * Math.SQRT2
        return {
            left: `calc(50% + ${screenX - half}px)`,
            top: `calc(50% + ${screenY - half - tipDrop}px)`,
            zIndex: 49999,
        }
    }

    return {
        TILE_W, TILE_IMG_H, getFilePath,
        getTileContainerStyle, getEditCellStyle, getSpawnMarkerStyle,
        tileTopSliceStyle, tileTopImgStyle,
        tileSideTopStyle, tileSideTopImgStyle,
        tileSideMiddleContainerStyle, tileSideMiddleImgStyle,
        tileSideBottomStyle, tileSideBottomImgStyle,
    }
}
