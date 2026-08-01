import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) return null

    const [user] = await db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        bio: users.bio,
        character: users.character,
        isAdmin: users.isAdmin,
    }).from(users).where(eq(users.id, Number(userid)))

    return user ?? null
})
