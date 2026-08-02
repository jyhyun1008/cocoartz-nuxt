import { db } from '../utils/db'
import { follows, posts, users, remoteFollows, remoteFeedPosts } from '../db/schema'
import { eq, and, inArray, isNull, desc } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) return []

    // 로컬 유저 팔로우 → posts (본인 글도 같이 — 타임라인이니 내가 쓴 글도 보여야 함)
    // 답글(replyto가 있는 글)이나 원격 팔로우 피드 글에 보낸 답글(remoteParentObjectId)은
    // 새 글이 아니라 댓글이라 타임라인에는 표시하지 않음
    const followingRows = await db.select({ userid: follows.userid }).from(follows)
        .where(eq(follows.followerUserId, userid))
    const followingIds = [...new Set([...followingRows.map(r => r.userid), userid])]

    let localItems: any[] = []
    if (followingIds.length) {
        localItems = await db.select().from(posts)
            .where(and(inArray(posts.userid, followingIds), isNull(posts.replyto), isNull(posts.remoteParentObjectId)))
            .orderBy(desc(posts.createdAt))
            .limit(30)

        for (const item of localItems) {
            const [author] = await db.select({
                username: users.username,
                knownas: users.knownas,
                avatar: users.avatar,
            }).from(users).where(eq(users.id, item.userid as number))
            item.user = author ?? null
            item.isRemote = false
            item.sortDate = item.createdAt
        }
    }

    // 원격 계정 팔로우 → remoteFeedPosts
    const remoteRows = await db.select().from(remoteFeedPosts)
        .where(eq(remoteFeedPosts.userid, userid))
        .orderBy(desc(remoteFeedPosts.published))
        .limit(30)

    const remoteItems = remoteRows.map((r) => ({
        id: `remote-${r.id}`,
        content: r.content,
        summary: r.summary,
        createdAt: r.published,
        sortDate: r.published,
        isRemote: true,
        sourceActorUrl: r.sourceActorUrl,
        sourceHandle: r.sourceHandle,
        sourceName: r.sourceName,
        sourceIconUrl: r.sourceIconUrl,
    }))

    return [...localItems, ...remoteItems]
        .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
        .slice(0, 30)
})
