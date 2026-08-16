import { db } from '../../utils/db'
import { rooms, servers } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { slug, id } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')

    await db.delete(rooms).where(eq(rooms.id, id))

    const [server] = await db.select().from(servers).where(eq(servers.slug, slug))
    if (server) {
        const current: any[] = server.rooms ? JSON.parse(server.rooms) : []
        const filtered = current.filter(entry => entry !== id)
        await db.update(servers).set({ rooms: JSON.stringify(filtered) }).where(eq(servers.slug, slug))
    }

    return { ok: true }
})
