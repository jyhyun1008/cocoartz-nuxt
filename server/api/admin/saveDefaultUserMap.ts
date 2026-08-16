import { db } from '../../utils/db'
import { servers } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

// 새 유저(혹은 아직 자기 방을 안 꾸민 유저)의 개인 방 기본 모습을 관리자가 정하는 템플릿을 저장.
// saveUserMap.ts(유저 본인 방)/admin/saveRoomMap.ts(채널 방)와 달리 특정 room/user가 아니라
// servers 테이블 자체에 저장됨 — slug는 클라이언트 입력을 안 믿고 서버 런타임 설정에서 직접 구함
// (이 배포가 서비스하는 서버가 어차피 하나뿐이라 클라이언트가 정할 이유가 없음).
export default eventHandler(async (event) => {
    const { map } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')

    const config = useRuntimeConfig()
    const slug = config.public.serverSlug as string

    const [updated] = await db.update(servers)
        .set({ defaultUserMap: map })
        .where(eq(servers.slug, slug))
        .returning()
    if (!updated) throw createError({ statusCode: 404, message: '서버 설정을 찾을 수 없습니다' })
    return updated
})
