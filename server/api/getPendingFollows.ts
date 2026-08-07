import { db } from '../utils/db'
import { follows, users } from '../db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'

// 팔로우 수동 승인 대기 목록(설정 여부 + 대기 중인 요청) — 로컬/원격 통합
export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) return { requireFollowApproval: false, pending: [] }

    const [me] = await db.select({ requireFollowApproval: users.requireFollowApproval })
        .from(users).where(eq(users.id, userid))

    const rows = await db.select().from(follows)
        .where(and(eq(follows.userid, userid), eq(follows.accepted, false)))
        .orderBy(desc(follows.createdAt))

    const localIds = rows.filter(r => r.followerUserId != null).map(r => r.followerUserId as number)
    const localUsers = localIds.length
        ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar })
            .from(users).where(inArray(users.id, localIds))
        : []
    const localById = new Map(localUsers.map(u => [u.id, u]))

    const pending = rows.map((r) => {
        if (r.followerUserId != null) {
            const u = localById.get(r.followerUserId)
            return { id: r.id, kind: 'local', username: u?.username, knownas: u?.knownas, avatar: u?.avatar }
        }
        return {
            id: r.id,
            kind: 'remote',
            actorUrl: r.followerActorUrl,
            name: r.remoteActorName,
            handle: r.remoteActorHandle,
            iconUrl: r.remoteActorIconUrl,
        }
    })

    return { requireFollowApproval: me?.requireFollowApproval ?? false, pending }
})
