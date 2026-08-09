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
    const { slug, path, knownas, type, info, galleryView } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)
    if (!path || !knownas || !type) throw createError({ statusCode: 400, message: '필수 항목 누락' })

    // 갤러리 보기는 게시판 채널에서만 의미가 있음(연합 여부는 생성 직후 별도 setFederatedRoom
    // 호출로 정해지는데, 그쪽에서 federated:true면 galleryView를 자동으로 꺼줌)
    const finalGalleryView = type === 'board' && galleryView === true

    const [room] = await db.insert(rooms).values({ path, knownas, type, info, galleryView: finalGalleryView }).returning()

    const [server] = await db.select().from(servers).where(eq(servers.slug, slug))
    if (server) {
        const current = server.rooms ? JSON.parse(server.rooms) : []
        current.push(room.id)
        await db.update(servers).set({ rooms: JSON.stringify(current) }).where(eq(servers.slug, slug))
    }

    return room
})
