import { db } from '../utils/db'
import { notifications, users } from '../db/schema'
import { eq, and, desc, count } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) return { notifications: [], unreadCount: 0 }

    const rows = await db.select().from(notifications)
        .where(eq(notifications.userid, userid))
        .orderBy(desc(notifications.createdAt))
        .limit(30)

    for (const row of rows) {
        if (row.actorUserId) {
            const [actor] = await db.select({
                username: users.username,
                knownas: users.knownas,
                avatar: users.avatar,
            }).from(users).where(eq(users.id, row.actorUserId))
            ;(row as any).actor = actor ?? null
        }
    }

    const [{ c: unreadCount }] = await db.select({ c: count() }).from(notifications)
        .where(and(eq(notifications.userid, userid), eq(notifications.read, false)))

    return { notifications: rows, unreadCount }
})
