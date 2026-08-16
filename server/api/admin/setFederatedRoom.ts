import { db } from '../../utils/db'
import { rooms, servers } from '../../db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { slug, roomid, federated } = await readBody(event)
    await requirePermission(event, 'accessAdminSettings')
    if (!roomid || !slug) throw createError({ statusCode: 400, message: '필수 항목 누락' })

    const [targetRoom] = await db.select().from(rooms).where(eq(rooms.id, roomid))
    if (!targetRoom) throw createError({ statusCode: 404, message: '채널을 찾을 수 없습니다' })
    if (targetRoom.type !== 'board') {
        throw createError({ statusCode: 400, message: '게시판 채널만 연합 게시판으로 지정할 수 있습니다' })
    }

    const [server] = await db.select().from(servers).where(eq(servers.slug, slug))
    if (!server) throw createError({ statusCode: 404, message: '서버를 찾을 수 없습니다' })

    const entries: unknown[] = server.rooms ? JSON.parse(server.rooms) : []
    const serverRoomIds = entries.filter((e): e is number => typeof e === 'number')
    if (!serverRoomIds.includes(roomid)) {
        throw createError({ statusCode: 400, message: '이 서버에 속하지 않은 채널입니다' })
    }

    if (federated) {
        // 다른 연합 게시판은 자동으로 해제 — 이 배포는 서버 1개를 전제로 하고(server당 1개 제한),
        // inbox.post.ts/_ws.ts의 "연합 게시판 찾기" 쿼리가 serverid 구분 없이 rooms 테이블 전체에서
        // federated=true인 행을 그냥 하나 집어오기 때문에, 예전엔 이 채널의 servers.rooms 배열에
        // 속한 행끼리만 해제해서 그 배열 밖으로 빠진(삭제/재생성으로 고아가 된) 예전 채널이 federated
        // 플래그를 계속 들고 있는 채로 남아 계속 잘못 골라지는 버그가 있었음 — 전체 테이블 기준으로 해제
        await db.transaction(async (tx) => {
            await tx.update(rooms).set({ federated: false }).where(and(eq(rooms.federated, true), ne(rooms.id, roomid)))
            // 연합 게시판은 갤러리 보기를 지원 안 함(원격 글까지 섞여서 정사각형 그리드가 안 맞음) —
            // 이미 갤러리로 켜져 있던 게시판을 연합으로 지정하면 조용히 꺼줌
            await tx.update(rooms).set({ federated: true, galleryView: false }).where(eq(rooms.id, roomid))
        })
    } else {
        await db.update(rooms).set({ federated: false }).where(eq(rooms.id, roomid))
    }

    const [updated] = await db.select().from(rooms).where(eq(rooms.id, roomid))
    return updated
})
