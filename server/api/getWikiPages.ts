import { db } from '../utils/db'
import { wikiPages, users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { roomid } = await readBody(event)
    const pages = await db.select().from(wikiPages).where(eq(wikiPages.roomid, roomid))
    const enriched = await Promise.all(pages.map(async (page) => {
        const [author] = await db.select().from(users).where(eq(users.id, page.authorid))
        const editor = page.editorid
            ? (await db.select().from(users).where(eq(users.id, page.editorid)))[0]
            : null
        return { ...page, author, editor }
    }))
    return enriched
})
