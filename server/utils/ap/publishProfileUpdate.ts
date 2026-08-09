import { db } from '../db'
import { users, actors, follows } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { actorUrl, buildActorObject, buildUpdateActivity } from './activitypub'
import { deliverToFollowers } from './deliver'

// 로컬 유저가 프로필(이름/소개/아바타)을 바꿨을 때, 이미 팔로우 중인 원격 팔로워들에게 즉시
// Update 액티비티로 알려줌 — 마스토돈 등 표준 구현체가 프로필 수정 시 하는 것과 동일한 푸시.
// (참고: Pull 쪽, 즉 원격 서버가 우리 액터를 다시 조회했을 때 최신 정보를 주는 건
// /users/[username] GET이 항상 DB에서 즉시 새로 만들어서 응답하므로 이미 정상 동작 중이었고,
// 여기서 하는 건 "이미 알고 있는" 팔로워들에게 다시 조회할 때까지 기다리지 않고 바로 알려주는 것)
export async function publishProfileUpdate(userid: number, domain: string) {
    const [author] = await db.select().from(users).where(eq(users.id, userid))
    if (!author) return

    // 연합에 참여한 적 없는(액터/키 페어가 없는) 로컬 전용 유저는 보낼 대상 자체가 없음
    const [actor] = await db.select().from(actors).where(eq(actors.userid, userid))
    if (!actor) return

    const followerRows = await db.select().from(follows)
        .where(and(eq(follows.userid, userid), eq(follows.accepted, true)))
    if (!followerRows.length) return

    const actorId = actorUrl(domain, author.username)
    const actorObject = buildActorObject(domain, {
        id: actorId,
        profileUrl: `https://${domain}/@${author.username}`,
        preferredUsername: author.username,
        name: author.knownas || author.username,
        summary: author.bio,
        avatar: author.avatar,
        banner: author.banner,
        publicKey: actor.publicKey,
    })
    const activity = buildUpdateActivity(domain, author.username, actorObject)

    // 실제 네트워크 배송은 publishPost.ts와 동일하게 fire-and-forget — 팔로워가 많아도
    // 응답이 지연되지 않게 함
    void deliverToFollowers(followerRows, activity, actorId, actor.privateKey)
        .catch((e) => console.error('[publishProfileUpdate] 팔로워 배포 실패', e))
}
