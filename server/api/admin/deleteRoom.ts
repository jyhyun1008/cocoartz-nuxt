import { db } from '../../utils/db'
import { rooms, servers, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { slug, id } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)

    await db.delete(rooms).where(eq(rooms.id, id))

    const [server] = await db.select().from(servers).where(eq(servers.slug, slug))
    if (server) {
        const current: any[] = server.rooms ? JSON.parse(server.rooms) : []
        const filtered = current.filter(entry => entry !== id)
        await db.update(servers).set({ rooms: JSON.stringify(filtered) }).where(eq(servers.slug, slug))
    }

    return { ok: true }
})
