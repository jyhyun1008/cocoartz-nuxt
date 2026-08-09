import { db } from '../../utils/db'
import { users, customEmojis } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { isObjectStorageConfigured, uploadImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '../../utils/objectStorage'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

const SHORTCODE_RE = /^[a-z0-9_]{2,30}$/

export default eventHandler(async (event) => {
    if (!isObjectStorageConfigured()) {
        throw createError({ statusCode: 400, message: '오브젝트 스토리지가 설정되지 않았습니다' })
    }

    const parts = await readMultipartFormData(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    const shortcode = parts?.find((p) => p.name === 'shortcode')?.data?.toString().trim().toLowerCase()
    if (!shortcode || !SHORTCODE_RE.test(shortcode)) {
        throw createError({ statusCode: 400, message: '샷코드는 영문 소문자/숫자/밑줄 2~30자여야 합니다' })
    }

    const [existing] = await db.select().from(customEmojis).where(eq(customEmojis.shortcode, shortcode))
    if (existing) {
        throw createError({ statusCode: 400, message: '이미 사용 중인 샷코드입니다' })
    }

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

    const imageUrl = await uploadImage(file.data, file.type, 'custom-emojis')

    const [emoji] = await db.insert(customEmojis).values({
        shortcode,
        imageUrl,
        imageType: file.type,
        createdBy: userid,
    }).returning()

    return emoji
})
