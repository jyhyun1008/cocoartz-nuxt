import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { isObjectStorageConfigured, uploadImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '../../utils/objectStorage'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    if (!isObjectStorageConfigured()) {
        throw createError({ statusCode: 400, message: '오브젝트 스토리지가 설정되지 않았습니다' })
    }

    const parts = await readMultipartFormData(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)

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

    const url = await uploadImage(file.data, file.type, 'server-icons')
    return { url }
})
