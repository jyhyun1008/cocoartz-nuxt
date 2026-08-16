import { db } from '../../utils/db'
import { rooms } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

// 마을(/)·공지 게시판(/noti)처럼 사이드바에 고정된 경로의 room을 찾거나 없으면 생성한다.
// createRoom.ts와 달리 servers.rooms 순서 배열에는 추가하지 않음 — 이 방들은
// ServerSidebar.vue에 하드코딩된 링크로만 노출되므로 동적 채널 목록에 중복 표시될 필요가 없음.
export default eventHandler(async (event) => {
    const { path, knownas, type } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')
    if (!path || !knownas || !type) throw createError({ statusCode: 400, message: '필수 항목 누락' })

    const [existing] = await db.select().from(rooms).where(eq(rooms.path, path))
    if (existing) return existing

    const [created] = await db.insert(rooms).values({ path, knownas, type }).returning()
    return created
})
