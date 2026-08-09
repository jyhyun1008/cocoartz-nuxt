import { db } from '../../utils/db'
import { rooms, servers, users } from '../../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { requireUserId } from '../../utils/session'

async function checkAdmin(userid: number) {
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userid))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
}

export default eventHandler(async (event) => {
    const { slug, roomid, federated } = await readBody(event)
    const userid = await requireUserId(event)
    await checkAdmin(userid)
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
        // 같은 서버 내 다른 연합 게시판은 자동으로 해제 (서버당 1개 제한)
        const otherIds = serverRoomIds.filter((id) => id !== roomid)
        await db.transaction(async (tx) => {
            if (otherIds.length) {
                await tx.update(rooms).set({ federated: false }).where(inArray(rooms.id, otherIds))
            }
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
