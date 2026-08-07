import { db } from './db'
import { posts, likes, remoteTimelinePosts, remoteFeedPosts, boosts, follows, remoteFollows } from '../db/schema'
import { eq } from 'drizzle-orm'
import { fetchActor, buildActorDisplayInfo } from './ap/activitypub'

// 원격 계정의 표시 이름/핸들/아이콘은 posts(댓글)/likes/remoteTimelinePosts/remoteFeedPosts/
// boosts/follows/remoteFollows 여기저기에 캐싱돼있음 — 그 계정의 최신 정보를 한 번 가져와서
// 이 모든 곳에 한꺼번에 반영하는 공통 함수. inbox의 Update 액티비티 처리(handleUpdate)뿐
// 아니라, 팔로우 목록 조회 시점에 오래된 캐시를 되살릴 때도 재사용함
export async function refreshRemoteActorCache(actorUrl: string): Promise<{ name: string; handle: string; iconUrl: string } | null> {
    const actorData = await fetchActor(actorUrl)
    if (!actorData) return null
    const info = buildActorDisplayInfo(actorData, actorUrl)
    const cachedAt = new Date()

    await db.update(posts)
        .set({ remoteActorName: info.name, remoteActorHandle: info.handle, remoteActorIconUrl: info.iconUrl })
        .where(eq(posts.remoteActorUrl, actorUrl))
    await db.update(likes)
        .set({ remoteActorName: info.name, remoteActorHandle: info.handle, remoteActorIconUrl: info.iconUrl })
        .where(eq(likes.remoteActorUrl, actorUrl))
    await db.update(remoteTimelinePosts)
        .set({ sourceName: info.name, sourceHandle: info.handle, sourceIconUrl: info.iconUrl })
        .where(eq(remoteTimelinePosts.sourceActorUrl, actorUrl))
    await db.update(remoteFeedPosts)
        .set({ sourceName: info.name, sourceHandle: info.handle, sourceIconUrl: info.iconUrl })
        .where(eq(remoteFeedPosts.sourceActorUrl, actorUrl))
    await db.update(boosts)
        .set({ actorName: info.name, actorHandle: info.handle, actorIconUrl: info.iconUrl })
        .where(eq(boosts.actorUrl, actorUrl))
    await db.update(follows)
        .set({ remoteActorName: info.name, remoteActorHandle: info.handle, remoteActorIconUrl: info.iconUrl, remoteActorCachedAt: cachedAt })
        .where(eq(follows.followerActorUrl, actorUrl))
    await db.update(remoteFollows)
        .set({ targetName: info.name, targetHandle: info.handle, targetIconUrl: info.iconUrl, remoteActorCachedAt: cachedAt })
        .where(eq(remoteFollows.targetActorUrl, actorUrl))

    return info
}

// 팔로우 목록처럼 "닉네임/프사"가 눈에 띄게 보이는 화면에서, 이 정도 지난 캐시는 조회
// 시점에 자동으로 다시 가져옴(원격 계정이 Update 액티비티를 안 보내는 서버 구현도 있어서
// 순수 push 방식만으로는 못 잡는 변경을 보완)
export const REMOTE_ACTOR_STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7일

export function isRemoteActorCacheStale(cachedAt: Date | null | undefined): boolean {
    if (!cachedAt) return true
    return Date.now() - cachedAt.getTime() > REMOTE_ACTOR_STALE_MS
}
