import { db } from '../utils/db'
import { wikiPages, users } from '../db/schema'
import { eq } from 'drizzle-orm'

function toSlug(title: string) {
    return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '')
}

export default eventHandler(async (event) => {
    const { serverid, roomid, userid, title, content } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const slug = toSlug(title)
    const [page] = await db.insert(wikiPages).values({
        serverid,
        roomid,
        title,
        slug,
        content,
        authorid: userid,
    }).returning()
    const [author] = await db.select().from(users).where(eq(users.id, userid))
    return { ...page, author, editor: null, history: [] }
})
