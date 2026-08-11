import { db } from '../utils/db'
import { users, posts, follows, rooms, remoteFollows, mutes } from '../db/schema'
import { eq, and, desc, count, inArray, isNull } from 'drizzle-orm'
import { getRemoteUserProfile } from '../utils/ap/remoteProfile'

export default defineEventHandler(async (event) => {
    const { username, viewerUserId } = await readBody(event)
    if (!username) return null

    // /@username@host — 리모트(fediverse) 유저 프로필. 로컬 유저명에 '@'를 막는 검증이 어디에도
    // 없어서(가입 폼도 별도 제한 없음) 혹시 겹치는 경우를 대비해 로컬 조회를 먼저 시도하고, 못 찾을
    // 때만 리모트로 취급함
    if (username.includes('@')) {
        const localMatch = await lookupLocalProfile(username, viewerUserId)
        if (localMatch) return localMatch
        return await getRemoteUserProfile(username, viewerUserId)
    }

    return await lookupLocalProfile(username, viewerUserId)
})

async function lookupLocalProfile(username: string, viewerUserId?: number) {
    const [user] = await db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        banner: users.banner,
        bio: users.bio,
        map: users.map,
        character: users.character,
        createdAt: users.createdAt,
    }).from(users).where(eq(users.username, username))

    if (!user) return null

    const userPosts = await db.select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
        roomid: posts.roomid,
    }).from(posts)
        // remoteParentObjectId가 있는 글(원격 글에 단 답글 스텁)과 마찬가지로, replyto가 있는
        // 글(게시판/연합 게시판에 댓글로 단 글)도 "글"이 아니라 "댓글"이라 프로필엔 안 보여야 함.
        // 예전엔 프론트(@[username].vue)의 topLevelPosts가 이 필터를 맡고 있었는데, 정작 여기서
        // replyto 필드 자체를 안 내려주고 있어서 그 필터가 항상 무력화돼 있었음(값이 늘 undefined
        // 라 !p.replyto가 항상 true) — 게다가 그 필터링은 LIMIT 20으로 잘라온 "뒤"에 프론트에서
        // 걸러내는 방식이라, SQL 단에서 걸러야 할 걸 나중에 거르면 댓글을 많이 단 유저는 최근 20개
        // 안에 진짜 글이 거의 안 남을 수도 있었음 — 그래서 remoteParentObjectId처럼 아예 SQL
        // where절로 옮김
        .where(and(eq(posts.userid, user.id), isNull(posts.remoteParentObjectId), isNull(posts.replyto)))
        .orderBy(desc(posts.createdAt))
        .limit(20)

    const roomIds = [...new Set(userPosts.map((p) => p.roomid))]
    const postRooms = roomIds.length
        ? await db.select({ id: rooms.id, path: rooms.path, knownas: rooms.knownas }).from(rooms).where(inArray(rooms.id, roomIds))
        : []
    const roomById = new Map(postRooms.map((r) => [r.id, r]))
    for (const post of userPosts) {
        ;(post as any).room = roomById.get(post.roomid) ?? null
    }

    const [{ c: followerCount }] = await db.select({ c: count() }).from(follows)
        .where(and(eq(follows.userid, user.id), eq(follows.accepted, true)))
    const [{ c: localFollowingCount }] = await db.select({ c: count() }).from(follows)
        .where(eq(follows.followerUserId, user.id))
    // 대기중(미승인) 원격 팔로우도 getRemoteFollows/설정 모달에서 이미 "팔로잉 목록"에 포함해서 보여주고 있으므로 동일 기준으로 합산
    const [{ c: remoteFollowingCount }] = await db.select({ c: count() }).from(remoteFollows)
        .where(eq(remoteFollows.userid, user.id))
    const followingCount = localFollowingCount + remoteFollowingCount

    let isFollowing = false
    let isFollowRequested = false
    let myMuteLevel = null
    if (viewerUserId) {
        const [row] = await db.select({ accepted: follows.accepted }).from(follows)
            .where(and(eq(follows.userid, user.id), eq(follows.followerUserId, viewerUserId)))
        isFollowing = !!row?.accepted
        isFollowRequested = !!row && !row.accepted

        const [muteRow] = await db.select({ level: mutes.level }).from(mutes)
            .where(and(eq(mutes.userid, viewerUserId), eq(mutes.targetUserId, user.id)))
        myMuteLevel = muteRow?.level ?? null
    }

    return { ...user, posts: userPosts, followerCount, followingCount, isFollowing, isFollowRequested, myMuteLevel }
}
