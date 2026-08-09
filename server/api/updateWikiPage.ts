import { db } from '../utils/db'
import { wikiPages, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { id, title, content } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [existing] = await db.select().from(wikiPages).where(eq(wikiPages.id, id))
    if (!existing) throw createError({ statusCode: 404, message: '페이지를 찾을 수 없습니다' })

    const prevHistory = existing.history ? JSON.parse(existing.history) : []
    const newHistory = [
        ...prevHistory,
        {
            title: existing.title,
            content: existing.content,
            editorid: existing.editorid ?? existing.authorid,
            editedAt: existing.updatedAt,
        },
    ].slice(-20)

    const [updated] = await db.update(wikiPages)
        .set({
            title,
            content,
            editorid: userid,
            history: JSON.stringify(newHistory),
            updatedAt: new Date(),
        })
        .where(eq(wikiPages.id, id))
        .returning()

    const [author] = await db.select().from(users).where(eq(users.id, updated.authorid))
    const [editor] = await db.select().from(users).where(eq(users.id, userid))
    return { ...updated, author, editor, history: newHistory }
})
