import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getUserBlockStatus } from '../utils/userStatus'
import { getOptionalUserId, destroyAuthSession } from '../utils/session'

// 모든 요청에 자동 적용되는 Nitro 미들웨어(server/middleware/*.ts는 파일명 순으로 매 요청마다 실행됨).
// 정지/영구정지된 계정이 "이미 로그인해서 열어둔 탭"으로 계속 API를 쓰는 것도 즉시 막기 위함 —
// 로그인 자체를 막는 server/api/auth/login.ts 체크만으로는 이미 발급된 세션을 막을 수 없음.
// 세션이 없으면(비로그인 요청) DB 조회 없이 바로 통과시켜서 불필요한 부하를 안 만듦.
// ⚠️ 예전엔 클라이언트가 읽고 쓸 수 있는 'user-id' 평문 쿠키로 판단했음 — 세션(server/utils/session.ts,
// 서버만 복호화 가능)으로 바꿔서 유저가 자기 쿠키를 조작해 이 체크를 우회하는 걸 막음.
export default defineEventHandler(async (event) => {
    const userid = await getOptionalUserId(event)
    if (!userid) return

    const [user] = await db.select({ deletedAt: users.deletedAt, bannedAt: users.bannedAt, suspendedUntil: users.suspendedUntil })
        .from(users).where(eq(users.id, userid))
    if (!user) return

    const status = getUserBlockStatus(user)
    if (!status.blocked) return

    deleteCookie(event, 'user-id')
    await destroyAuthSession(event)
    throw createError({
        statusCode: 403,
        message: status.kind === 'deleted' ? '탈퇴한 계정입니다' : status.kind === 'banned' ? '영구정지된 계정입니다' : '일시정지된 계정입니다',
    })
})
