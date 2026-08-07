import { db } from '../utils/db'
import { follows, posts, users, remoteFeedPosts } from '../db/schema'
import { eq, and, inArray, isNull, desc } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter } from '../utils/mutes'

const PAGE_SIZE = 20

// 개인 홈 타임라인 — 로컬 팔로우 글(posts)과 원격 팔로우 글(remoteFeedPosts)을 각각 독립적으로
// 페이지네이션해서 반환한다 (WindowBoard.vue가 로컬/원격 게시판 글을 페이징하는 것과 동일한 패턴).
// 프론트에서 두 목록을 각자 누적하다가 합쳐서 날짜순으로 다시 정렬해 보여줌
export default eventHandler(async (event) => {
    const { userid, localOffset, remoteOffset } = await readBody(event)
    if (!userid) return { localPosts: [], hasMoreLocal: false, remotePosts: [], hasMoreRemote: false }

    // 로컬 유저 팔로우 → posts (본인 글도 같이 — 타임라인이니 내가 쓴 글도 보여야 함)
    // 답글(replyto가 있는 글)이나 원격 팔로우 피드 글에 보낸 답글(remoteParentObjectId)은
    // 새 글이 아니라 댓글이라 타임라인에는 표시하지 않음
    const followingRows = await db.select({ userid: follows.userid }).from(follows)
        .where(eq(follows.followerUserId, userid))
    const followingIds = [...new Set([...followingRows.map(r => r.userid), userid])]

    const muteLookup = await getMuteLookup(userid)

    let localPosts: any[] = []
    let hasMoreLocal = false
    if (followingIds.length) {
        const rows = await db.select().from(posts)
            .where(and(inArray(posts.userid, followingIds), isNull(posts.replyto), isNull(posts.remoteParentObjectId)))
            .orderBy(desc(posts.createdAt))
            .limit(PAGE_SIZE + 1)
            .offset(localOffset ?? 0)

        hasMoreLocal = rows.length > PAGE_SIZE
        localPosts = rows.slice(0, PAGE_SIZE)

        for (const item of localPosts) {
            const [author] = await db.select({
                username: users.username,
                knownas: users.knownas,
                avatar: users.avatar,
            }).from(users).where(eq(users.id, item.userid as number))
            item.user = author ?? null
            item.isRemote = false
            item.sortDate = item.createdAt
        }
        localPosts = applyMuteFilter(localPosts, muteLookup, (p) => ({ userid: p.userid, actorUrl: p.remoteActorUrl }))
    }

    // 원격 계정 팔로우 → remoteFeedPosts
    const remoteRows = await db.select().from(remoteFeedPosts)
        .where(eq(remoteFeedPosts.userid, userid))
        .orderBy(desc(remoteFeedPosts.published))
        .limit(PAGE_SIZE + 1)
        .offset(remoteOffset ?? 0)

    const hasMoreRemote = remoteRows.length > PAGE_SIZE
    let remotePosts = remoteRows.slice(0, PAGE_SIZE).map((r) => ({
        id: `remote-${r.id}`, // 로컬 글과 id 공간이 겹칠 수 있어 v-for :key 충돌 방지용 접두사
        feedPostId: r.id, // 좋아요/답글 API 호출용 실제 숫자 id
        objectId: r.objectId, // 댓글 목록 조회(getRemoteFeedPostReplies)용
        content: r.content,
        summary: r.summary,
        quoteUrl: r.quoteUrl,
        linkUrl: r.linkUrl,
        createdAt: r.published,
        sortDate: r.published,
        isRemote: true,
        liked: r.liked,
        sourceActorUrl: r.sourceActorUrl,
        sourceHandle: r.sourceHandle,
        sourceName: r.sourceName,
        sourceIconUrl: r.sourceIconUrl,
        boostedByActorUrl: r.boostedByActorUrl,
        boostedByName: r.boostedByName,
        boostedByHandle: r.boostedByHandle,
        boostedByIconUrl: r.boostedByIconUrl,
    }))
    remotePosts = applyMuteFilter(remotePosts, muteLookup, (p) => ({ actorUrl: p.sourceActorUrl }))

    return { localPosts, hasMoreLocal, remotePosts, hasMoreRemote }
})
