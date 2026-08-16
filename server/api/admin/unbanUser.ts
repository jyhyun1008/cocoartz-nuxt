import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    const { id } = await readBody(event)
    await requirePermission(event, ['accessAdminSettings', 'moderateUsers'])
    if (!id) throw createError({ statusCode: 400, message: '대상 유저가 필요합니다' })

    const [updated] = await db.update(users)
        .set({ bannedAt: null, banReason: null })
        .where(eq(users.id, id))
        .returning()
    if (!updated) throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })

    return { ok: true }
})
