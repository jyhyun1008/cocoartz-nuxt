import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid, map } = await readBody(event)
    if (!userid) throw createError({ statusCode: 400, message: '로그인이 필요합니다' })
    await db.update(users).set({ map }).where(eq(users.id, Number(userid)))
    return { ok: true }
})
