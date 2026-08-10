// outfit(한벌옷)·deco(데코)는 body/face/hair처럼 "항상 끼는" 기본 파츠가 아니라 있으면 켜지는
// 선택 슬롯이라 DEFAULT_CHARACTER엔 안 넣어둠(아래 getCharacterLayers 참고). 탭 목록(useShopCategories.ts)
// 순서에도 그대로 쓰이므로 순서 자체가 상점/인벤토리 탭 순서가 됨
export const CHARACTER_PARTS = ['body', 'shoes', 'bottom', 'top', 'outfit', 'face', 'hair', 'deco'] as const
export type CharacterPart = typeof CHARACTER_PARTS[number]

// 현재 각 파트의 최대 variant 수 (새 파일 추가 시 여기만 수정)
export const CHARACTER_PART_COUNTS: Record<string, number> = {
    body: 1,
    face: 1,
    hair: 1,
    bottom: 1,
    shoes: 1,
    top: 1,
    outfit: 1,
    deco: 1,
}

export const DEFAULT_CHARACTER: Record<string, number | null> = {
    body: 1, face: 1, hair: 1, bottom: 1, shoes: 1, top: 1,
}

export interface CharacterLayers {
    // 기존과 동일한 형태(몸통 파츠들, body→shoes→bottom/outfit→top→face→hair) — 다른 파츠와 같은
    // 768x1024/셀 256x256 스프라이트라 CharacterMoving.vue/OtherCharacter.vue가 손볼 것 없이 그대로 씀
    layers: string[]
    // 데코는 스프라이트 치수가 다르고(768x1424, 셀 256x356 — 위로 100px 더 큼) 몸통 스택의 맨 뒤/맨 앞에
    // 따로 붙어야 해서 layers와 분리해서 내려줌. 한 번에 하나만 장착 가능하니 always 둘 중 하나만 참
    backDeco: string | null
    frontDeco: string | null
}

// character JSON 문자열 → 레이어 정보. 기본 렌더링 순서는 body → shoes → bottom → top → face → hair.
// 특수 슬롯 2개:
// - outfit(한벌옷): 끼고 있으면 bottom+top을 대신함(상호 배타 — 실제로 둘 다 값이 있어도(장착 UI가
//   막아주긴 하지만 혹시 몰라 방어적으로) outfit이 있으면 bottom/top은 무시하고 그 자리에 outfit만 넣음)
// - deco(데코): 몸 전체 스택의 맨 앞(front) 또는 맨 뒤(back)에 따로 붙음 — 그 판정은 이 함수가 모르는
//   정보(아이템의 meta.layer)라 resolveDecoLayer 콜백으로 받아옴. 다른 파츠와 스프라이트 치수가
//   달라서(CharacterMoving.vue 참고) layers 배열엔 안 섞고 backDeco/frontDeco로 따로 반환함
// resolveImage를 안 넘기면 예전처럼 `/character/{part}/{variant}.png` 관례 경로를 그대로 씀.
// 관리자가 상점 페이지에서 파츠 스프라이트시트를 직접 업로드한 경우(useAvatarPartCatalog.ts)를
// 반영하려면 호출부(RoomMap.vue/UserRoomEmbed.vue)에서 getAvatarPartImage를 넘겨줄 것.
export function getCharacterLayers(
    character: string | null | undefined,
    resolveImage?: (part: string, variant: number) => string,
    resolveDecoLayer?: (variant: number) => 'front' | 'back',
): CharacterLayers {
    let config: Record<string, number | null> = { ...DEFAULT_CHARACTER }
    if (character) {
        try { config = { ...DEFAULT_CHARACTER, ...JSON.parse(character) } } catch {}
    }

    const resolve = (part: string, variant: number) =>
        resolveImage ? resolveImage(part, variant) : `/character/${part}/${variant}.png`

    const bodyParts = CHARACTER_PARTS.filter(part => part !== 'outfit' && part !== 'deco')
    // outfit이 있으면 bottom/top 자리를 outfit 하나로 교체(같은 위치에 끼워 넣어야 상의/하의
    // 사이에 있던 순서가 그대로 유지됨 — 신발 위, 얼굴 아래)
    const order: string[] = config.outfit
        ? bodyParts.flatMap(part => (part === 'bottom' ? ['outfit'] : part === 'top' ? [] : [part]))
        : [...bodyParts]

    const layers = order.filter(part => config[part]).map(part => resolve(part, config[part]!))

    let backDeco: string | null = null
    let frontDeco: string | null = null
    if (config.deco) {
        const decoUrl = resolve('deco', config.deco)
        const layer = resolveDecoLayer ? resolveDecoLayer(config.deco) : 'back'
        if (layer === 'front') frontDeco = decoUrl
        else backDeco = decoUrl
    }

    return { layers, backDeco, frontDeco }
}
