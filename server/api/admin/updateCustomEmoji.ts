import { db } from '../../utils/db'
import { users, customEmojis } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

// 이미 올려둔 커스텀 이모지의 카테고리/검색 태그만 나중에 채우거나 고칠 수 있게 함(피커
// 분류/검색 기능이 나중에 추가돼서, 그전에 올린 이모지들도 소급 적용 가능해야 함).
// 샷코드/이미지는 여기서 안 건드림 — 게시글에 이미 :shortcode:로 쓰인 게 있으면 바뀌면 안 되니까
export default eventHandler(async (event) => {
    const { id, category, tags } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)
    if (!id) throw createError({ statusCode: 400, message: 'id가 필요합니다' })

    const [emoji] = await db.update(customEmojis).set({
        category: category?.toString().trim() || null,
        tags: tags?.toString().trim() || null,
    }).where(eq(customEmojis.id, id)).returning()

    if (!emoji) throw createError({ statusCode: 404, message: '존재하지 않는 이모지입니다' })
    return emoji
})
