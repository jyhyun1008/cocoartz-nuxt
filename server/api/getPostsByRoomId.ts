import { db } from '../utils/db'
import { posts, users } from '../db/schema'
import { eq, and, isNull, desc, inArray } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter, getWordMuteLookup, applyWordMuteFilter, getEmojiMuteLookup } from '../utils/mutes'

const PAGE_SIZE = 20

export default eventHandler(async (event) => {
    const { serverid, roomid, offset, viewerUserId } = await readBody(event)
    const rows = await db.select().from(posts).where(
        and(eq(posts.serverid, serverid), eq(posts.roomid, roomid), isNull(posts.replyto), isNull(posts.remoteParentObjectId))
    ).orderBy(desc(posts.createdAt)).limit(PAGE_SIZE + 1).offset(offset ?? 0)

    const hasMore = rows.length > PAGE_SIZE
    let results = rows.slice(0, PAGE_SIZE)

    const userIds = [...new Set(results.map(r => r.userid).filter((id): id is number => id != null))]
    const userRows = userIds.length
        ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar }).from(users).where(inArray(users.id, userIds))
        : []
    const userById = new Map(userRows.map(u => [u.id, u]))
    for (const result of results) {
        ;(result as any).user = result.userid != null ? userById.get(result.userid) : undefined
    }

    const muteLookup = await getMuteLookup(viewerUserId)
    results = applyMuteFilter(results, muteLookup, (p) => ({ userid: p.userid, actorUrl: p.remoteActorUrl }))
    const wordMuteLookup = await getWordMuteLookup(viewerUserId)
    results = applyWordMuteFilter(results, wordMuteLookup, (p) => `${p.title ?? ''} ${p.content ?? ''}`)
    const emojiMuteLookup = await getEmojiMuteLookup(viewerUserId)
    results = applyWordMuteFilter(results, emojiMuteLookup, (p) => `${p.title ?? ''} ${p.content ?? ''}`)

    return { posts: results, hasMore }
})
