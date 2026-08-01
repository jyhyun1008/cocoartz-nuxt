import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid, knownas, bio, avatar } = await readBody(event)

    if (!userid) throw createError({ statusCode: 400, message: '로그인이 필요합니다' })

    const [updated] = await db.update(users).set({
        ...(knownas !== undefined ? { knownas: knownas.trim() || null } : {}),
        ...(bio !== undefined ? { bio: bio.trim() || null } : {}),
        ...(avatar !== undefined ? { avatar: avatar.trim() || null } : {}),
    }).where(eq(users.id, Number(userid)))
    .returning({ username: users.username })

    return { ok: true, username: updated.username }
})
