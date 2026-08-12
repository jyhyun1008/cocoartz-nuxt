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

// 맵 아이템/작물 레이어 칸 하나만 업로드(관리자 화면의 1~6번 칸을 각각 클릭해서 올리는 방식) —
// 6장을 한 번에 다 골라야 했던 예전 방식과 달리 칸 하나만 바꿔도 되고, 안 바꾼 칸은 재업로드가
// 안 일어나서 오브젝트 스토리지 용량을 아낌. 합성 아이콘은 여기서 안 만듦 — createShopItem/
// updateShopItem이 최종 6장(이번에 새로 올린 것 + 그대로 둔 기존 것)이 확정된 뒤에 만듦
export async function uploadSingleMapItemLayer(parts: MultiPartData[] | undefined): Promise<string> {
    if (!isObjectStorageConfigured()) {
        throw createError({ statusCode: 400, message: '오브젝트 스토리지가 설정되지 않았습니다' })
    }
    const file = findPart(parts, 'file')
    validateImageFile(file, '레이어 이미지')
    return uploadImage(file!.data, file!.type!, 'map-items')
}

// 최종 확정된 레이어 URL 6장으로 합성 아이콘을 만듦 — 맵 아이템/작물의 layers는 항상 위 업로드
// 함수를 통해서만 채워지는(관리자가 임의 URL을 직접 입력할 방법이 없는) 우리 자신의 오브젝트
// 스토리지 URL이라 그대로 fetch해서 버퍼로 받아와도 안전함(SSRF 우려 없음)
export async function compositeIconFromLayerUrls(urls: string[]): Promise<Buffer> {
    const buffers = await Promise.all(urls.map(async (url) => {
        const res = await fetch(url)
        if (!res.ok) throw createError({ statusCode: 500, message: '레이어 이미지를 불러오는 데 실패했습니다' })
        return Buffer.from(await res.arrayBuffer())
    }))
    return compositeMapItemIcon(buffers)
}
