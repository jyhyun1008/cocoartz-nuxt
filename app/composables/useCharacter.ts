export const CHARACTER_PARTS = ['body', 'shoes', 'bottom', 'top', 'face', 'hair'] as const
export type CharacterPart = typeof CHARACTER_PARTS[number]

// 현재 각 파트의 최대 variant 수 (새 파일 추가 시 여기만 수정)
export const CHARACTER_PART_COUNTS: Record<string, number> = {
    body: 1,
    face: 1,
    hair: 1,
    bottom: 1,
    shoes: 1,
    top: 1,
}

export const DEFAULT_CHARACTER: Record<string, number | null> = {
    body: 1, face: 1, hair: 1, bottom: 1, shoes: 1, top: 1,
}

// character JSON 문자열 → 레이어 URL 배열 (렌더링 순서: body → shoes → bottom → top → face → hair)
export function getCharacterLayers(character: string | null | undefined): string[] {
    let config: Record<string, number | null> = { ...DEFAULT_CHARACTER }
    if (character) {
        try { config = { ...DEFAULT_CHARACTER, ...JSON.parse(character) } } catch {}
    }
    return CHARACTER_PARTS
        .filter(part => config[part])
        .map(part => `/character/${part}/${config[part]}.png`)
}
