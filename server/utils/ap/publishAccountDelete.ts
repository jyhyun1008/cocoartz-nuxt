import { db } from '../db'
import { users, actors, follows, remoteFollows, posts } from '../../db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { actorUrl, buildDeleteActorActivity, buildDeleteActivity } from './activitypub'
import { deliverToFollowers } from './deliver'

// 탈퇴(deleteAccount.ts)/서버 자체 삭제(server/db/selfDestruct.ts) 양쪽에서 공용으로 쓰는 발송
// 로직 — 계정 자체의 Delete(마스토돈의 DeleteActorSerializer와 동일 모양: object가 액터 URI
// 문자열 그대로)와, 이 유저가 이미 연합에 배포해둔 게시글들의 개별 Delete(게시글용 Tombstone
// 모양, deletePost.ts와 동일)를 같이 보냄 — 액터 Delete 하나로 "콘텐츠도 알아서 없어졌겠지"라고
// 추론해주는 서버도 있지만, 명시적으로 게시글 Delete도 같이 보내는 쪽이 더 확실함(마스토돈도 그럼).
//
// 발송 대상: (1) 이 유저를 팔로우하던 원격 팔로워 전원(followers), (2) 이 유저가 팔로우하던
// 원격 상대 전원(following) — 팔로잉 쪽도 알려야 상대 서버가 팔로워 수 등 자기 쪽 상태를 정리함.
// 실패해도(원격 서버가 이미 죽었거나 응답 없음) 로컬 탈퇴 처리 자체엔 영향 없음(fire-and-forget).
export async function publishAccountDelete(userid: number, domain: string) {
    const [actor] = await db.select().from(actors).where(eq(actors.userid, userid))
    if (!actor) return // 연합에 참여한 적 없는(액터/키 페어가 없는) 유저는 보낼 대상 자체가 없음

    const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userid))
    if (!user) return

    const actorId = actorUrl(domain, user.username)

    const [followerRows, followingRows] = await Promise.all([
        db.select().from(follows).where(and(eq(follows.userid, userid), eq(follows.accepted, true))),
        db.select().from(remoteFollows).where(eq(remoteFollows.userid, userid)),
    ])
    // deliverToFollowers는 { followerInbox } 모양만 보므로, 팔로잉 쪽(targetInbox)도 같은
    // 모양으로 맞춰서 재사용함
    const targets = [
        ...followerRows.map((r) => ({ followerInbox: r.followerInbox })),
        ...followingRows.map((r) => ({ followerInbox: r.targetInbox })),
    ]
    if (!targets.length) return

    const actorDelete = buildDeleteActorActivity(actorId)
    void deliverToFollowers(targets, actorDelete, actorId, actor.privateKey)
        .catch((e) => console.error('[publishAccountDelete] 액터 Delete 배포 실패', e))

    // 이 유저가 연합에 이미 배포해둔(objectId 있는) 게시글들도 각각 Delete — deletePost.ts와
    // 동일한 모양의 활동을 같은 팔로워 목록에 재사용해서 뿌림(팔로잉 쪽엔 굳이 안 보냄 — 게시글은
    // 팔로워한테 보인 것이지 팔로잉 상대한테 보인 게 아니므로)
    const postRows = await db.select({ objectId: posts.objectId }).from(posts)
        .where(and(eq(posts.userid, userid), isNotNull(posts.objectId)))
    for (const post of postRows) {
        if (!post.objectId) continue
        const postDelete = buildDeleteActivity(domain, user.username, post.objectId)
        void deliverToFollowers(followerRows, postDelete, actorId, actor.privateKey)
            .catch((e) => console.error(`[publishAccountDelete] 게시글 Delete 배포 실패 (${post.objectId})`, e))
    }
}
