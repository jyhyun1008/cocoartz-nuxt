import { db } from '../utils/db'
import { notifications, users } from '../db/schema'
import { eq, and, desc, count, inArray } from 'drizzle-orm'
import { getOptionalUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const userid = await getOptionalUserId(event)
    if (!userid) return { notifications: [], unreadCount: 0 }

    const rows = await db.select().from(notifications)
        .where(eq(notifications.userid, userid))
        .orderBy(desc(notifications.createdAt))
        .limit(30)

    const actorIds = [...new Set(rows.map(r => r.actorUserId).filter((id): id is number => id != null))]
    const actorRows = actorIds.length
        ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar }).from(users).where(inArray(users.id, actorIds))
        : []
    const actorById = new Map(actorRows.map(u => [u.id, u]))
    for (const row of rows) {
        ;(row as any).actor = row.actorUserId != null ? (actorById.get(row.actorUserId) ?? null) : null
    }

    const [{ c: unreadCount }] = await db.select({ c: count() }).from(notifications)
        .where(and(eq(notifications.userid, userid), eq(notifications.read, false)))

    return { notifications: rows, unreadCount }
})
