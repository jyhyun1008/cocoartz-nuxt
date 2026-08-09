import { db } from '../utils/db'
import { wikiPages, users } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { roomid } = await readBody(event)
    const pages = await db.select().from(wikiPages).where(eq(wikiPages.roomid, roomid))

    // 페이지 하나마다 작성자/최종편집자를 따로 조회하던 걸(최대 2*N번) 한 번의 배치 조회로 합침
    const userIds = [...new Set([
        ...pages.map(p => p.authorid),
        ...pages.map(p => p.editorid).filter((id): id is number => id != null),
    ])]
    const userRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : []
    const userById = new Map(userRows.map(u => [u.id, u]))

    return pages.map((page) => ({
        ...page,
        author: userById.get(page.authorid),
        editor: page.editorid != null ? (userById.get(page.editorid) ?? null) : null,
    }))
})
