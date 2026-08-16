import { db } from '../../utils/db'
import { rooms } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { id, map } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')

    const [updated] = await db.update(rooms)
        .set({ map, updatedAt: new Date() })
        .where(eq(rooms.id, id))
        .returning()
    return updated
})
