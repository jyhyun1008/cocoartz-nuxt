import { db } from '../utils/db'
import { users, follows, remoteFollows } from '../db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { username, type } = await readBody(event)
    if (!username || (type !== 'followers' && type !== 'following')) return []

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
    if (!user) return []

    if (type === 'followers') {
        const rows = await db.select().from(follows)
            .where(and(eq(follows.userid, user.id), eq(follows.accepted, true)))
            .orderBy(desc(follows.createdAt))

        const localIds = rows.filter(r => r.followerUserId).map(r => r.followerUserId as number)
        const localUsers = localIds.length
            ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar })
                .from(users).where(inArray(users.id, localIds))
            : []
        const localById = new Map(localUsers.map(u => [u.id, u]))

        return rows.map((r) => {
            if (r.followerUserId) {
                const u = localById.get(r.followerUserId)
                return { kind: 'local', username: u?.username, knownas: u?.knownas, avatar: u?.avatar }
            }
            return {
                kind: 'remote',
                actorUrl: r.followerActorUrl,
                name: r.remoteActorName,
                handle: r.remoteActorHandle,
                iconUrl: r.remoteActorIconUrl,
            }
        })
    }

    const localFollowingRows = await db.select({ followedUserId: follows.userid }).from(follows)
        .where(eq(follows.followerUserId, user.id))
    const followedIds = localFollowingRows.map(r => r.followedUserId)
    const localUsers = followedIds.length
        ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar })
            .from(users).where(inArray(users.id, followedIds))
        : []
    const remoteRows = await db.select().from(remoteFollows)
        .where(eq(remoteFollows.userid, user.id))
        .orderBy(desc(remoteFollows.createdAt))

    return [
        ...localUsers.map(u => ({ kind: 'local', username: u.username, knownas: u.knownas, avatar: u.avatar })),
        ...remoteRows.map(r => ({
            kind: 'remote',
            actorUrl: r.targetActorUrl,
            name: r.targetName,
            handle: r.targetHandle,
            iconUrl: r.targetIconUrl,
            accepted: r.accepted,
        })),
    ]
})
