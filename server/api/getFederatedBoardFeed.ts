import { db } from '../utils/db'
import { posts, users, remoteTimelinePosts, remoteTimelinePostLikes } from '../db/schema'
import { sql, inArray, eq, and } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter, getWordMuteLookup, applyWordMuteFilter } from '../utils/mutes'

const PAGE_SIZE = 20

// 연합 게시판 — 이 방의 로컬 글(posts)과 서버 전체 연합 타임라인(remoteTimelinePosts)을 합쳐서
// 보여줌. 예전엔 두 소스를 각자 offset/limit으로 따로 가져와서 프론트에서 합친 뒤 재정렬했는데,
// 원격(서버 전체 팔로잉 firehose)이 로컬(이 방 글만)보다 훨씬 촘촘해서 "각자 20개"를 합치면
// 로컬 글이 항상 그 배치의 오래된 쪽 끝에 몰려 보이는 문제가 있었음 — 반드시 두 소스를 같은
// 정렬 기준으로 한 번에 잘라야 해결됨.
//
// 그래서 1단계로 두 테이블에서 정렬 기준(날짜)과 최소 식별자(id, kind)만 뽑아 UNION ALL로 합친
// 뒤 진짜 페이지 경계를 정하고, 2단계로 그 페이지에 든 id들만 각 테이블에서 제대로 조회해서
// (작성자 정보, 좋아요 여부 등) 살을 붙임.
export default eventHandler(async (event) => {
    const { serverid, roomid, viewerUserId, offset } = await readBody(event)
    const off = offset ?? 0

    // 재게시 글은 원본 published가 아니라 "우리 서버가 재게시를 받은 시각"(createdAt) 기준으로
    // 정렬 — getRemoteFeedPosts.ts/getFollowingFeed.ts와 동일한 이유
    const cursorRows = await db.execute<{ id: number; kind: 'local' | 'remote' }>(sql`
        SELECT id, kind FROM (
            (SELECT id, 'local' AS kind, "createdAt" AS sort_date
             FROM posts
             WHERE serverid = ${serverid} AND roomid = ${roomid}
                 AND replyto IS NULL AND "remoteParentObjectId" IS NULL)
            UNION ALL
            (SELECT id, 'remote' AS kind,
                CASE WHEN "boostedByActorUrl" IS NOT NULL THEN "createdAt" ELSE published END AS sort_date
             FROM remote_timeline_posts)
        ) combined
        ORDER BY sort_date DESC
        LIMIT ${PAGE_SIZE + 1} OFFSET ${off}
    `)

    const hasMore = cursorRows.length > PAGE_SIZE
    const page = cursorRows.slice(0, PAGE_SIZE)
    const localIds = page.filter((r) => r.kind === 'local').map((r) => r.id)
    const remoteIds = page.filter((r) => r.kind === 'remote').map((r) => r.id)

    const [localRows, remoteRows] = await Promise.all([
        localIds.length ? db.select().from(posts).where(inArray(posts.id, localIds)) : Promise.resolve([] as (typeof posts.$inferSelect)[]),
        remoteIds.length ? db.select().from(remoteTimelinePosts).where(inArray(remoteTimelinePosts.id, remoteIds)) : Promise.resolve([] as (typeof remoteTimelinePosts.$inferSelect)[]),
    ])

    // 로컬 글 작성자 정보
    for (const row of localRows as any[]) {
        const userinfo = row.userid
            ? await db.select({ username: users.username, knownas: users.knownas, avatar: users.avatar }).from(users).where(eq(users.id, row.userid))
            : []
        row.user = userinfo[0] ?? null
    }

    // 원격 글: 재게시면 표시용 published도 effective date로 맞춤(getRemoteFeedPosts.ts와 동일)
    for (const row of remoteRows as any[]) {
        if (row.boostedByActorUrl) row.published = row.createdAt
    }

    // 원격 글 좋아요 여부
    let likedSet = new Set<number>()
    if (viewerUserId && remoteRows.length) {
        const likedRows = await db.select({ remoteTimelinePostId: remoteTimelinePostLikes.remoteTimelinePostId })
            .from(remoteTimelinePostLikes)
            .where(and(inArray(remoteTimelinePostLikes.remoteTimelinePostId, remoteRows.map((r: any) => r.id)), eq(remoteTimelinePostLikes.userid, viewerUserId)))
        likedSet = new Set(likedRows.map((r) => r.remoteTimelinePostId))
    }
    for (const row of remoteRows as any[]) row.liked = likedSet.has(row.id)

    // 뮤트 필터 — 로컬/원격 각자의 기존 방식 그대로(로컬은 userid/remoteActorUrl, 원격은 sourceActorUrl)
    const muteLookup = await getMuteLookup(viewerUserId)
    let filteredLocal = applyMuteFilter(localRows as any[], muteLookup, (p) => ({ userid: p.userid, actorUrl: p.remoteActorUrl }))
    let filteredRemote = applyMuteFilter(remoteRows as any[], muteLookup, (p) => ({ actorUrl: p.sourceActorUrl }))

    // 단어/정규식 뮤트 — 작성자와 무관하게 제목+본문 텍스트로 필터
    const wordMuteLookup = await getWordMuteLookup(viewerUserId)
    filteredLocal = applyWordMuteFilter(filteredLocal, wordMuteLookup, (p) => `${p.title ?? ''} ${p.content ?? ''}`)
    filteredRemote = applyWordMuteFilter(filteredRemote, wordMuteLookup, (p) => p.content)

    // union 쿼리가 정한 순서(page)를 그대로 유지하며 kind를 붙여 합침 — inArray select는 원래
    // 순서를 안 지켜주므로 id→row 매핑 후 page 순서대로 재배열. 하드뮤트로 걸러진 건 자연히 빠짐
    const localById = new Map(filteredLocal.map((r) => [r.id, r]))
    const remoteById = new Map(filteredRemote.map((r) => [r.id, r]))
    const items = page
        .map((r) => r.kind === 'local'
            ? { kind: 'local' as const, post: localById.get(r.id) }
            : { kind: 'remote' as const, post: remoteById.get(r.id) })
        .filter((entry) => entry.post)

    return { items, hasMore }
})
