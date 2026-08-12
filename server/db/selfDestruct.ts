// 사용법: npx tsx server/db/selfDestruct.ts
//
// 마스토돈의 `tootctl self-destruct`와 같은 목적 — 이 서버를 완전히 내리기 전에 한 번 실행해서,
// "로컬 유저 전원의 계정이 없어졌다"는 Delete 액티비티를 그 유저들의 팔로워/팔로잉 상대(연합
// 상대 서버들)에게 브로드캐스트함. 다른 서버가 이 서버 유저들을 팔로워/타임라인에 계속
// 유령처럼 캐싱해두는 걸 막기 위함.
//
// ⚠️ 마스토돈과 동일하게, 이 스크립트는 로컬 DB를 전혀 안 건드림 — 연합 상대에게 "삭제됐다"고
// 알리기만 함. 실제 로컬 데이터 삭제(DB 드롭/볼륨 삭제 등)는 이 스크립트 실행 후 직접 하면 됨.
// 되돌릴 수 없고, 이 스크립트를 실행한 도메인은 나중에 다른 서버에 재사용하지 않는 게 좋음
// (연합 상대에 남은 캐시와 꼬일 수 있음).
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import readline from 'node:readline/promises'
import { users, actors, follows, remoteFollows } from './schema'
import { and, eq, isNull } from 'drizzle-orm'
import { actorUrl, buildDeleteActorActivity } from '../utils/ap/activitypub'
import { deliverToFollowers } from '../utils/ap/deliver'
import * as dotenv from 'dotenv'
dotenv.config()

const domain = process.env.DOMAIN
if (!domain) {
    console.error('❌ DOMAIN 환경변수가 없습니다 — 이 서버의 공개 도메인이 있어야 액터 URL을 만들 수 있어요')
    process.exit(1)
}

const client = postgres(process.env.DATABASE_URL ?? '', { prepare: false })
const db = drizzle(client)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
async function confirm(prompt: string, expected: string): Promise<boolean> {
    const answer = await rl.question(`${prompt}\n> `)
    return answer.trim() === expected
}

console.log(`⚠️  이 스크립트는 "${domain}" 서버의 유저 전원에 대해 연합 전체에 Delete를 방송합니다.`)
console.log('   되돌릴 수 없고, 이 서버를 정말로 영구히 내릴 때만 실행해야 해요.')
console.log('   (로컬 DB는 안 건드립니다 — 그건 이후 직접 지우세요)\n')

const ok1 = await confirm(`계속하려면 도메인을 정확히 입력하세요: ${domain}`, domain)
if (!ok1) { console.log('중단했습니다.'); await client.end(); process.exit(0) }

const ok2 = await confirm(`정말 확실한가요? 다시 한번 도메인을 입력하세요: ${domain}`, domain)
if (!ok2) { console.log('중단했습니다.'); await client.end(); process.exit(0) }

rl.close()

const localUsers = await db.select({ id: users.id, username: users.username })
    .from(users).where(isNull(users.deletedAt))

let sent = 0
for (const user of localUsers) {
    const [actor] = await db.select().from(actors).where(eq(actors.userid, user.id))
    if (!actor) continue // 연합에 참여한 적 없는 유저는 보낼 대상 자체가 없음

    const [followerRows, followingRows] = await Promise.all([
        db.select().from(follows).where(and(eq(follows.userid, user.id), eq(follows.accepted, true))),
        db.select().from(remoteFollows).where(eq(remoteFollows.userid, user.id)),
    ])
    const targets = [
        ...followerRows.map((r) => ({ followerInbox: r.followerInbox })),
        ...followingRows.map((r) => ({ followerInbox: r.targetInbox })),
    ]
    if (!targets.length) continue

    const actorId = actorUrl(domain, user.username)
    const activity = buildDeleteActorActivity(actorId)
    await deliverToFollowers(targets, activity, actorId, actor.privateKey)
    sent++
    console.log(`  → @${user.username}: ${targets.length}곳에 Delete 발송`)
}

console.log(`\n✅ 완료 — 유저 ${sent}명에 대해 Delete를 방송했어요.`)
console.log('   로컬 데이터 삭제는 별도로 진행하세요(예: docker compose down -v, DB 삭제 등).')

await client.end()
