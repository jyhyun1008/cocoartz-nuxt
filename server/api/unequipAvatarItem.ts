import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../utils/session'
import { broadcastUserUpdate } from '../routes/_ws'

// outfit(한벌옷)/deco(데코)처럼 "있다/없다"가 아니라 "끼거나 안 끼거나"인 선택 슬롯 전용 —
// body/hair/face/bottom/top/shoes는 항상 뭔가 껴있어야 하는 필수 슬롯이라 해제 개념이 없음(그쪽은
// equipAvatarItem.ts로 다른 variant로 갈아끼우기만 함). 이 엔드포인트는 그 슬롯 값만 지움.
export default eventHandler(async (event) => {
    const { category } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (category !== 'avatar_outfit' && category !== 'avatar_deco') {
        throw createError({ statusCode: 400, message: '해제할 수 없는 카테고리입니다' })
    }
    const part = category.slice('avatar_'.length)

    const [user] = await db.select({ character: users.character }).from(users).where(eq(users.id, userid))
    let config: Record<string, unknown> = {}
    try { config = user?.character ? JSON.parse(user.character) : {} } catch { config = {} }
    delete config[part]

    const [updatedUser] = await db.update(users).set({ character: JSON.stringify(config) })
        .where(eq(users.id, userid))
        .returning()

    broadcastUserUpdate(userid, updatedUser)

    return { ok: true, character: config }
})
