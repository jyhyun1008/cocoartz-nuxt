import sharp from 'sharp'

// MapItem.vue의 실제 스프라이트 스태킹 수식(레이어별 세로 눌림 squashRatio·간격 gapPerLayer)을
// 그대로 재현해서, 관리자가 업로드한 레이어들을 실제로 맵에 놓였을 때 모습과 동일하게 미리 합성한
// 썸네일을 만듦. 값들은 전부 MapItem.vue의 defineProps 기본값과 동일 — 그쪽 수식이 바뀌면 여기도 맞춰야 함.
// topRatio는 0.5(줌 중간 지점, useItemCatalog.ts가 flipBackOffsets 기준점으로 삼는 값과 동일)로 고정.
const SPRITE_WIDTH = 230
const SPRITE_HEIGHT = 256
const DISPLAY_WIDTH = 128
const ZOOMED_IN_TOP_RATIO = 1 / 3
const SQUASH_AT_ZOOMED_IN = 0.67
const GAP_RATIO_AT_ZOOMED_IN = 5 / (128 * 256 / 230)
const ZOOMED_OUT_TOP_RATIO = 0.584
const SQUASH_AT_ZOOMED_OUT = 1.16
const GAP_RATIO_AT_ZOOMED_OUT = -0.5 / (128 * 256 / 230)
const ICON_TOP_RATIO = 0.5

function lerp2(topRatio: number, aT: number, aV: number, bT: number, bV: number) {
    const t = (topRatio - aT) / (bT - aT)
    return aV + (bV - aV) * t
}

/**
 * 정면(위→아래, 1.png~6.png) 순서의 레이어 이미지 버퍼들을 실제 화면과 같은 비율로 겹쳐서
 * 하나의 아이콘 PNG 버퍼로 합성함. layers.length는 보통 6이지만 다른 장수도 허용.
 */
export async function compositeMapItemIcon(layerBuffers: Buffer[]): Promise<Buffer> {
    const n = layerBuffers.length
    if (!n) throw new Error('레이어 이미지가 없습니다')

    const squashRatio = lerp2(ICON_TOP_RATIO, ZOOMED_IN_TOP_RATIO, SQUASH_AT_ZOOMED_IN, ZOOMED_OUT_TOP_RATIO, SQUASH_AT_ZOOMED_OUT)
    const gapRatio = lerp2(ICON_TOP_RATIO, ZOOMED_IN_TOP_RATIO, GAP_RATIO_AT_ZOOMED_IN, ZOOMED_OUT_TOP_RATIO, GAP_RATIO_AT_ZOOMED_OUT)
    const stackBaseHeight = DISPLAY_WIDTH * SPRITE_HEIGHT / SPRITE_WIDTH
    const layerHeight = stackBaseHeight * squashRatio
    const gapPerLayer = gapRatio * stackBaseHeight

    const extraTop = (n - 1) * gapPerLayer
    const canvasW = Math.round(DISPLAY_WIDTH)
    const canvasH = Math.round(layerHeight + extraTop)
    const layerW = Math.round(DISPLAY_WIDTH)
    const layerH = Math.round(layerHeight)

    const composites: { input: Buffer, left: number, top: number }[] = []
    // z-index 낮은 것부터(맨 아래 레이어, 배열 마지막)부터 쌓아야 앞쪽(1.png)이 맨 위에 그려짐
    for (let i = n - 1; i >= 0; i--) {
        const baseShift = (n - 1 - i) * gapPerLayer
        const y = Math.round(-baseShift + extraTop)
        const resized = await sharp(layerBuffers[i]).resize(layerW, layerH, { fit: 'fill' }).png().toBuffer()
        composites.push({ input: resized, left: 0, top: y })
    }

    const canvas = sharp({
        create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
    const composed = await canvas.composite(composites).png().toBuffer()
    const trimmed = await sharp(composed).trim().png().toBuffer()
    return sharp(trimmed).resize({ width: 220, height: 220, fit: 'inside' }).png().toBuffer()
}
