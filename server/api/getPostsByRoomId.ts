import { db } from '../utils/db'
import { posts, users } from '../db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'

const PAGE_SIZE = 20

export default eventHandler(async (event) => {
    const { serverid, roomid, offset } = await readBody(event)
    const rows = await db.select().from(posts).where(
        and(eq(posts.serverid, serverid), eq(posts.roomid, roomid), isNull(posts.replyto))
    ).orderBy(desc(posts.createdAt)).limit(PAGE_SIZE + 1).offset(offset ?? 0)

    const hasMore = rows.length > PAGE_SIZE
    const results = rows.slice(0, PAGE_SIZE)

    for (const result of results) {
        const userinfo = result.userid ? await db.select().from(users).where(eq(users.id, result.userid)) : []
        ;(result as any).user = userinfo[0]
    }
    return { posts: results, hasMore }
})
