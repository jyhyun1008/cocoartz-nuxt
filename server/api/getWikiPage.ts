import { db } from '../utils/db'
import { wikiPages, users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { id } = await readBody(event)
    const [page] = await db.select().from(wikiPages).where(eq(wikiPages.id, id))
    if (!page) throw createError({ statusCode: 404, message: '페이지를 찾을 수 없습니다' })
    const [author] = await db.select().from(users).where(eq(users.id, page.authorid))
    const editor = page.editorid
        ? (await db.select().from(users).where(eq(users.id, page.editorid)))[0]
        : null
    const history = page.history ? JSON.parse(page.history) : []
    return { ...page, author, editor, history }
})
