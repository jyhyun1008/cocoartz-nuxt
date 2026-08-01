import { db } from '../utils/db'
import { notifications } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    await db.update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.userid, userid), eq(notifications.read, false)))

    return { ok: true }
})
