import { db } from '../utils/db'
import { mutes, users } from '../db/schema'
import { eq, inArray, desc } from 'drizzle-orm'
import { getOptionalUserId } from '../utils/session'

// 뮤트 관리(해제) 목록용 — 로컬/원격 뮤트를 한 배열로 합쳐서 반환
export default eventHandler(async (event) => {
    const userid = await getOptionalUserId(event)
    if (!userid) return []

    const rows = await db.select().from(mutes).where(eq(mutes.userid, userid)).orderBy(desc(mutes.createdAt))

    const localIds = rows.filter(r => r.targetUserId != null).map(r => r.targetUserId as number)
    const localUsers = localIds.length
        ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar })
            .from(users).where(inArray(users.id, localIds))
        : []
    const localById = new Map(localUsers.map(u => [u.id, u]))

    return rows.map((r) => {
        if (r.targetUserId != null) {
            const u = localById.get(r.targetUserId)
            return {
                id: r.id,
                kind: 'local',
                level: r.level,
                targetUserId: r.targetUserId,
                username: u?.username,
                knownas: u?.knownas,
                avatar: u?.avatar,
            }
        }
        return {
            id: r.id,
            kind: 'remote',
            level: r.level,
            targetActorUrl: r.targetActorUrl,
            name: r.targetActorName,
            handle: r.targetActorHandle,
            iconUrl: r.targetActorIconUrl,
        }
    })
})
