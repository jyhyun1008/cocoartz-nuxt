import { db } from '../../utils/db'
import { servers } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { slug, roomsList } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')

    const [updated] = await db.update(servers)
        .set({ rooms: JSON.stringify(roomsList) })
        .where(eq(servers.slug, slug))
        .returning()
    return updated
})
