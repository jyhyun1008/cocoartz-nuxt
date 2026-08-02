import { isObjectStorageConfigured, uploadImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '../utils/objectStorage'

export default eventHandler(async (event) => {
    if (!isObjectStorageConfigured()) {
        throw createError({ statusCode: 400, message: '오브젝트 스토리지가 설정되지 않았습니다' })
    }

    const parts = await readMultipartFormData(event)
    const userid = Number(parts?.find((p) => p.name === 'userid')?.data?.toString())
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const file = parts?.find((p) => p.name === 'file')
    if (!file?.data || !file.type) {
        throw createError({ statusCode: 400, message: '파일이 없습니다' })
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw createError({ statusCode: 400, message: '지원하지 않는 이미지 형식입니다 (png/jpeg/webp/gif만 가능)' })
    }
    if (file.data.length > MAX_IMAGE_SIZE) {
        throw createError({ statusCode: 400, message: '파일 크기는 5MB 이하여야 합니다' })
    }

    const url = await uploadImage(file.data, file.type, 'banners')
    return { url }
})
