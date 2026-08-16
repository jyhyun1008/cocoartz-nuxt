import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    await requirePermission(event, 'accessAdminSettings')

    return db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        knownas: users.knownas,
        avatar: users.avatar,
        createdAt: users.createdAt,
    }).from(users)
        .where(and(eq(users.approved, false), eq(users.isAdmin, false)))
        .orderBy(desc(users.createdAt))
})
