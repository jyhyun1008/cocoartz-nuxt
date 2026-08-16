import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getOptionalUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const userid = await getOptionalUserId(event)
    if (!userid) return null

    const [user] = await db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        bio: users.bio,
        character: users.character,
        isAdmin: users.isAdmin,
        permissions: users.permissions,
    }).from(users).where(eq(users.id, Number(userid)))

    return user ?? null
})
