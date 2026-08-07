import { db } from '../utils/db'
import { users, posts, follows, rooms, remoteFollows, mutes } from '../db/schema'
import { eq, and, desc, count, inArray, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    const { username, viewerUserId } = await readBody(event)
    if (!username) return null

    const [user] = await db.select({
        id: users.id,
        username: users.username,
        knownas: users.knownas,
        avatar: users.avatar,
        banner: users.banner,
        bio: users.bio,
        map: users.map,
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
        // remoteParentObjectId가 있는 글은 개인 타임라인에서 원격 글에 단 답글 스텁이라 프로필엔 안 보여야 함
        .where(and(eq(posts.userid, user.id), isNull(posts.remoteParentObjectId)))
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
})
