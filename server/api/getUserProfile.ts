import { db } from '../utils/db'
import { users, posts, follows } from '../db/schema'
import { eq, and, desc, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    const { username, viewerUserId } = await readBody(event)
    if (!username) return null

    const [user] = await db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        banner: users.banner,
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

    const [{ c: followerCount }] = await db.select({ c: count() }).from(follows)
        .where(and(eq(follows.userid, user.id), eq(follows.accepted, true)))
    const [{ c: followingCount }] = await db.select({ c: count() }).from(follows)
        .where(eq(follows.followerUserId, user.id))

    let isFollowing = false
    if (viewerUserId) {
        const [row] = await db.select().from(follows)
            .where(and(eq(follows.userid, user.id), eq(follows.followerUserId, viewerUserId)))
        isFollowing = !!row
    }

    return { ...user, posts: userPosts, followerCount, followingCount, isFollowing }
})
