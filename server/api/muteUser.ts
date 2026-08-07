import { db } from '../utils/db'
import { mutes } from '../db/schema'
import { fetchActor } from '../utils/ap/activitypub'
import { renderActorName } from '../utils/ap/sanitize'

export default eventHandler(async (event) => {
    const { userid, targetUserId, targetActorUrl, level } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (level !== 'soft' && level !== 'hard') throw createError({ statusCode: 400, message: 'level은 soft 또는 hard여야 합니다' })
    if (!targetUserId && !targetActorUrl) throw createError({ statusCode: 400, message: '뮤트 대상이 필요합니다' })
    if (targetUserId && targetUserId === userid) throw createError({ statusCode: 400, message: '자기 자신은 뮤트할 수 없습니다' })

    if (targetUserId) {
        const [row] = await db.insert(mutes).values({
            userid, targetUserId, level,
        }).onConflictDoUpdate({
            target: [mutes.userid, mutes.targetUserId],
            set: { level },
        }).returning()
        return row
    }

    // 원격 대상 — 뮤트 관리 목록에 이름/핸들/아이콘이 나오도록 캐시(액터 조회 실패해도 뮤트 자체는 진행)
    const actorData = await fetchActor(targetActorUrl).catch(() => null)
    const preferredUsername = (actorData?.preferredUsername as string) || ''
    let targetActorHandle = ''
    try {
        targetActorHandle = preferredUsername ? `@${preferredUsername}@${new URL(targetActorUrl).hostname}` : ''
    } catch { /* actorUrl이 이상해도 뮤트 자체는 진행 */ }
    const targetActorName = renderActorName((actorData?.name as string) || preferredUsername, actorData?.tag)
    const targetActorIconUrl = (actorData?.icon as Record<string, string> | undefined)?.url || ''

    const [row] = await db.insert(mutes).values({
        userid, targetActorUrl, targetActorName, targetActorHandle, targetActorIconUrl, level,
    }).onConflictDoUpdate({
        target: [mutes.userid, mutes.targetActorUrl],
        set: { level, targetActorName, targetActorHandle, targetActorIconUrl },
    }).returning()
    return row
})
