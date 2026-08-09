import { db } from '../utils/db'
import { posts, users } from '../db/schema'
import { eq, inArray, or } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter, getWordMuteLookup, applyWordMuteFilter, getEmojiMuteLookup } from '../utils/mutes'

// 안전장치 — 비정상적으로 깊거나(혹은 순환된) 스레드 때문에 무한루프 도는 것을 막기 위한 최대 단계 수
const MAX_DEPTH = 20

// 팔로우 피드에 뜬 원격 글에 달린 답글 전부(몇 단계로 중첩됐든) — 답글끼리 연결되는 방식이 두 가지라
// 매 단계 새로 찾은 답글들의 id/objectId를 다음 단계의 검색 기준으로 삼아 더 이상 안 나올 때까지 반복함
// (BFS): 로컬 답글 체인은 replyto(부모의 posts.id)로, 원격에서 또 달린 답글은 remoteParentObjectId
// (부모의 objectId)로 이어짐 — 부모가 로컬 유저든 원격 계정이든 상관없이 둘 다 적용될 수 있음
export default eventHandler(async (event) => {
    const { objectId, viewerUserId } = await readBody(event)
    if (!objectId) return []

    const all: any[] = []
    const seenIds = new Set<number>()
    let frontierObjectIds: string[] = [objectId]
    let frontierIds: number[] = []

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
        const conditions = []
        if (frontierObjectIds.length) conditions.push(inArray(posts.remoteParentObjectId, frontierObjectIds))
        if (frontierIds.length) conditions.push(inArray(posts.replyto, frontierIds.map(String)))
        if (!conditions.length) break

        const rows = await db.select().from(posts).where(or(...conditions))
        const fresh = rows.filter((r) => !seenIds.has(r.id))
        if (!fresh.length) break

        for (const r of fresh) seenIds.add(r.id)
        all.push(...fresh)

        frontierObjectIds = fresh.filter((r) => r.objectId).map((r) => r.objectId as string)
        frontierIds = fresh.map((r) => r.id)
    }

    const replyUserIds = [...new Set(all.map(item => item.userid).filter((id): id is number => id != null))]
    const replyUserRows = replyUserIds.length
        ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar }).from(users).where(inArray(users.id, replyUserIds))
        : []
    const replyUserById = new Map(replyUserRows.map(u => [u.id, u]))
    for (const item of all) {
        ;(item as any).user = (item.userid != null ? replyUserById.get(item.userid) : null) ?? null
    }

    const muteLookup = await getMuteLookup(viewerUserId)
    let filtered = applyMuteFilter(all, muteLookup, (item) => ({ userid: item.userid, actorUrl: item.remoteActorUrl }))
    const wordMuteLookup = await getWordMuteLookup(viewerUserId)
    filtered = applyWordMuteFilter(filtered, wordMuteLookup, (item) => item.content)
    const emojiMuteLookup = await getEmojiMuteLookup(viewerUserId)
    filtered = applyWordMuteFilter(filtered, emojiMuteLookup, (item) => item.content)

    return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})
