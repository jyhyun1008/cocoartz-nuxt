import { db } from '../utils/db'
import { users, follows, remoteFollows } from '../db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { refreshRemoteActorCache, isRemoteActorCacheStale } from '../utils/remoteActorCache'

// 팔로워/팔로잉 목록에 뜬 원격 계정 캐시가 비어있거나(예전에 캐시 컬럼이 생기기 전에 들어온
// 팔로우 — 이 경우 remoteActorCachedAt도 마이그레이션 시점 값으로 채워져서 "오래됨" 판정만으로는
// 못 잡음) 오래됐으면(REMOTE_ACTOR_STALE_MS 이상) 조회 시점에 다시 가져와서 반영 — 닉네임/
// 프사가 바뀌었는데도 원격 서버가 Update 액티비티를 안 보내는 경우까지 커버하기 위함
async function refreshStaleActors<T extends { followerUserId?: number | null; targetActorUrl?: string; followerActorUrl?: string; remoteActorHandle?: string | null; targetHandle?: string | null; remoteActorCachedAt?: Date | null }>(
    rows: T[],
    getActorUrl: (row: T) => string | undefined,
) {
    for (const row of rows) {
        if (row.followerUserId) continue // 로컬 유저는 대상 아님
        const handle = row.remoteActorHandle ?? row.targetHandle
        const needsRefresh = !handle || isRemoteActorCacheStale(row.remoteActorCachedAt)
        if (!needsRefresh) continue
        const actorUrl = getActorUrl(row)
        if (!actorUrl) continue
        const info = await refreshRemoteActorCache(actorUrl)
        if (!info) continue
        if ('remoteActorHandle' in row) {
            (row as any).remoteActorName = info.name
            ;(row as any).remoteActorHandle = info.handle
            ;(row as any).remoteActorIconUrl = info.iconUrl
        } else {
            (row as any).targetName = info.name
            ;(row as any).targetHandle = info.handle
            ;(row as any).targetIconUrl = info.iconUrl
        }
    }
}

export default eventHandler(async (event) => {
    const { username, type } = await readBody(event)
    if (!username || (type !== 'followers' && type !== 'following')) return []

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
    if (!user) return []

    if (type === 'followers') {
        const rows = await db.select().from(follows)
            .where(and(eq(follows.userid, user.id), eq(follows.accepted, true)))
            .orderBy(desc(follows.createdAt))

        await refreshStaleActors(rows, (r) => r.followerActorUrl)

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

    await refreshStaleActors(remoteRows, (r) => r.targetActorUrl)

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
