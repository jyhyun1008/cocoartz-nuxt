import type { MultiPartData } from 'h3'
import { isObjectStorageConfigured, uploadImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from './objectStorage'
import { compositeMapItemIcon } from './mapItemIcon'

export function findPart(parts: MultiPartData[] | undefined, name: string) {
    return parts?.find(p => p.name === name)
}

export function partString(parts: MultiPartData[] | undefined, name: string) {
    return findPart(parts, name)?.data?.toString()
}

function validateImageFile(file: MultiPartData | undefined, label: string) {
    if (!file?.data || !file.type) throw createError({ statusCode: 400, message: `${label}이(가) 없습니다` })
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw createError({ statusCode: 400, message: '지원하지 않는 이미지 형식입니다 (png/jpeg/webp/gif만 가능)' })
    }
    if (file.data.length > MAX_IMAGE_SIZE) {
        throw createError({ statusCode: 400, message: `${label} 크기는 5MB 이하여야 합니다` })
    }
}

// 상점 아이템 아이콘 이미지 하나 업로드(아바타/지형/기능/소모품 카테고리용) — uploadAvatar.ts와
// 같은 "선택하면 바로 업로드해서 URL을 돌려받는" 패턴. 그 URL을 폼에 채워뒀다가 나중에
// createShopItem/updateShopItem 호출할 때 문자열로 같이 보냄(그쪽 엔드포인트는 파일을 직접 안 받음)
export async function uploadSingleImage(parts: MultiPartData[] | undefined, fieldName: string, prefix: string): Promise<string> {
    if (!isObjectStorageConfigured()) {
        throw createError({ statusCode: 400, message: '오브젝트 스토리지가 설정되지 않았습니다' })
    }
    const file = findPart(parts, fieldName)
    validateImageFile(file, '이미지')
    return uploadImage(file!.data, file!.type!, prefix)
}

// 맵 아이템 6장 레이어(layer1~layer6 파트) — 업로드하고, 실제 인게임 스태킹 모습 그대로 합성한
// 아이콘까지 자동으로 만들어서 같이 올림. 6장 전부 있어야 하고(부분 교체는 지원 안 함), 오브젝트
// 스토리지가 없으면 애초에 이 기능 자체를 못 씀(공용 이모지 업로드와 같은 제약)
export async function uploadMapItemLayers(parts: MultiPartData[] | undefined): Promise<{ layers: string[], icon: string }> {
    if (!isObjectStorageConfigured()) {
        throw createError({ statusCode: 400, message: '오브젝트 스토리지가 설정되지 않았습니다' })
    }

    const files: MultiPartData[] = []
    for (let i = 1; i <= 6; i++) {
        const file = findPart(parts, `layer${i}`)
        validateImageFile(file, `레이어 ${i}`)
        files.push(file!)
    }

    const layers: string[] = []
    for (const file of files) {
        layers.push(await uploadImage(file.data, file.type!, 'map-items'))
    }

    const iconBuffer = await compositeMapItemIcon(files.map(f => f.data))
    const icon = await uploadImage(iconBuffer, 'image/png', 'map-items')

    return { layers, icon }
}
