import { db } from '../../utils/db'
import { rooms, users } from '../../db/schema'
import { eq } from 'drizzle-orm'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { userid, id, path, knownas, type, info, galleryView } = await readBody(event)
    await checkAdmin(userid)

    const [existing] = await db.select({ type: rooms.type, federated: rooms.federated }).from(rooms).where(eq(rooms.id, id))
    if (!existing) throw createError({ statusCode: 404, message: '채널을 찾을 수 없습니다' })

    // 갤러리 보기는 게시판 + 비연합 채널에서만 허용 — 연합 게시판은 setFederatedRoom.ts에서
    // federated:true로 켤 때 이미 galleryView를 꺼주지만, type을 여기서 board가 아닌 걸로
    // 바꾸는 경우까지 같이 커버하기 위해 여기서도 한 번 더 강제함
    const finalType = type ?? existing.type
    const finalGalleryView = finalType === 'board' && !existing.federated && galleryView === true

    const [updated] = await db.update(rooms)
        .set({ path, knownas, type, info, galleryView: finalGalleryView, updatedAt: new Date() })
        .where(eq(rooms.id, id))
        .returning()
    return updated
})
