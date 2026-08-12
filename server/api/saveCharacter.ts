import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../utils/session'
import { apiError } from '../utils/apiError'

export default eventHandler(async (event) => {
    const { character } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw apiError(400, 'AUTH_REQUIRED', '로그인이 필요합니다')
    await db.update(users).set({ character }).where(eq(users.id, Number(userid)))
    return { ok: true }
})
