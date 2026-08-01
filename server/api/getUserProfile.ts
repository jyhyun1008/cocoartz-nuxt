import { db } from '../utils/db'
import { users, posts } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    const { username } = await readBody(event)
    if (!username) return null

    const [user] = await db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        bio: users.bio,
        map: users.map,
        createdAt: users.createdAt,
    }).from(users).where(eq(users.username, username))

    if (!user) return null

    const userPosts = await db.select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
        roomid: posts.roomid,
    }).from(posts)
        .where(eq(posts.userid, user.id))
        .orderBy(desc(posts.createdAt))
        .limit(20)

    return { ...user, posts: userPosts }
})
