import { db } from '../../utils/db'
import { rooms, servers } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { slug, path, knownas, type, info, galleryView, isAnnouncement } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')
    if (!path || !knownas || !type) throw createError({ statusCode: 400, message: '필수 항목 누락' })

    // 갤러리 보기/공지 채널은 둘 다 게시판 채널에서만 의미가 있음(연합 여부는 생성 직후 별도
    // setFederatedRoom 호출로 정해지는데, 그쪽에서 federated:true면 galleryView를 자동으로 꺼줌)
    const finalGalleryView = type === 'board' && galleryView === true
    const finalIsAnnouncement = type === 'board' && isAnnouncement === true

    const [room] = await db.insert(rooms).values({ path, knownas, type, info, galleryView: finalGalleryView, isAnnouncement: finalIsAnnouncement }).returning()

    const [server] = await db.select().from(servers).where(eq(servers.slug, slug))
    if (server) {
        const current = server.rooms ? JSON.parse(server.rooms) : []
        current.push(room.id)
        await db.update(servers).set({ rooms: JSON.stringify(current) }).where(eq(servers.slug, slug))
    }

    return room
})
