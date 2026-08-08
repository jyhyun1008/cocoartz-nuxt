import { db } from '../utils/db'
import { emojiMutes } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid, id } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (!id) throw createError({ statusCode: 400, message: '대상이 필요합니다' })

    await db.delete(emojiMutes).where(and(eq(emojiMutes.id, id), eq(emojiMutes.userid, userid)))
    return { ok: true }
})
