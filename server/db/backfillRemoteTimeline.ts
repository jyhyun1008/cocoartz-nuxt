// 1회성 백필: 기존에 유저별로 쌓여있던 remoteFeedPosts(공개 글) 중 objectId 기준으로 중복 제거해서
// 서버 공용 연합 타임라인(remoteTimelinePosts)에 채워넣는다. sourceInbox는 remoteFollows에서 조인해서 채움.
// 사용법: npx tsx server/db/backfillRemoteTimeline.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { remoteFeedPosts, remoteFollows, remoteTimelinePosts } from './schema'
import { eq, and } from 'drizzle-orm'
import * as dotenv from 'dotenv'
dotenv.config()

const client = postgres(process.env.DATABASE_URL ?? '', { prepare: false })
const db = drizzle(client)

const publicFeedPosts = await db.select().from(remoteFeedPosts).where(eq(remoteFeedPosts.isPublic, true))

let inserted = 0
let skippedNoInbox = 0

for (const feedPost of publicFeedPosts) {
    const [follow] = await db.select().from(remoteFollows)
        .where(and(eq(remoteFollows.userid, feedPost.userid), eq(remoteFollows.targetActorUrl, feedPost.sourceActorUrl)))
    if (!follow) {
        skippedNoInbox++
        continue
    }

    const result = await db.insert(remoteTimelinePosts).values({
        sourceActorUrl: feedPost.sourceActorUrl,
        sourceInbox: follow.targetInbox,
        sourceHandle: feedPost.sourceHandle,
        sourceName: feedPost.sourceName,
        sourceIconUrl: feedPost.sourceIconUrl,
        objectId: feedPost.objectId,
        content: feedPost.content,
        summary: feedPost.summary,
        published: feedPost.published,
    }).onConflictDoNothing({ target: remoteTimelinePosts.objectId }).returning({ id: remoteTimelinePosts.id })

    if (result.length) inserted++
}

console.log(`✅ 백필 완료: ${inserted}개 저장, ${skippedNoInbox}개는 팔로우 관계(inbox)를 못 찾아 건너뜀 (전체 후보 ${publicFeedPosts.length}개)`)

await client.end()
