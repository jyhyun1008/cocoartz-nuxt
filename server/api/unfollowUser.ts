import { db } from '../utils/db'
import { users, follows } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid, targetUsername } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!targetUsername) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })

    const [target] = await db.select().from(users).where(eq(users.username, targetUsername))
    if (!target) throw createError({ statusCode: 404, message: '존재하지 않는 유저입니다' })

    await db.delete(follows).where(
        and(eq(follows.userid, target.id), eq(follows.followerUserId, userid))
    )

    return { ok: true }
})
