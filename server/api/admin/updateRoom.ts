import { db } from '../../utils/db'
import { rooms } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { id, path, knownas, type, info, galleryView, isAnnouncement } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')

    const [existing] = await db.select({ type: rooms.type, federated: rooms.federated }).from(rooms).where(eq(rooms.id, id))
    if (!existing) throw createError({ statusCode: 404, message: '채널을 찾을 수 없습니다' })

    // 갤러리 보기는 게시판 + 비연합 채널에서만 허용 — 연합 게시판은 setFederatedRoom.ts에서
    // federated:true로 켤 때 이미 galleryView를 꺼주지만, type을 여기서 board가 아닌 걸로
    // 바꾸는 경우까지 같이 커버하기 위해 여기서도 한 번 더 강제함
    const finalType = type ?? existing.type
    const finalGalleryView = finalType === 'board' && !existing.federated && galleryView === true
    // 공지 채널은 갤러리 보기와 달리 연합 여부와 무관 — 게시판이기만 하면 됨
    const finalIsAnnouncement = finalType === 'board' && isAnnouncement === true

    const [updated] = await db.update(rooms)
        .set({ path, knownas, type, info, galleryView: finalGalleryView, isAnnouncement: finalIsAnnouncement, updatedAt: new Date() })
        .where(eq(rooms.id, id))
        .returning()
    return updated
})
