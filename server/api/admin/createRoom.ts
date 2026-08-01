import { db } from '../../utils/db'
import { rooms, servers, users } from '../../db/schema'
import { eq } from 'drizzle-orm'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { userid, slug, path, knownas, type, info } = await readBody(event)
    await checkAdmin(userid)
    if (!path || !knownas || !type) throw createError({ statusCode: 400, message: '필수 항목 누락' })

    const [room] = await db.insert(rooms).values({ path, knownas, type, info }).returning()

    const [server] = await db.select().from(servers).where(eq(servers.slug, slug))
    if (server) {
        const current = server.rooms ? JSON.parse(server.rooms) : []
        current.push(room.id)
        await db.update(servers).set({ rooms: JSON.stringify(current) }).where(eq(servers.slug, slug))
    }

    return room
})
