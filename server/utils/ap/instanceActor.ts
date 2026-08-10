import { db } from '../db'
import { servers } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { generateRsaKeyPair } from './crypto'

// 이 배포는 서버 1개를 전제로 함(server/api/getMembers.ts 등 기존 코드와 동일한 전제) — 그래서
// servers 테이블의 첫 번째(유일한) 행에 인스턴스 액터 키페어를 그냥 얹어둠. 처음 필요해질 때
// (즉 마스토돈 등 서명 요구하는 서버와 최초로 마주쳤을 때) 지연 생성됨 — ensureActor.ts(유저별
// 액터)와 동일한 패턴.
export async function ensureInstanceActor(): Promise<{ publicKey: string; privateKey: string } | null> {
    const [server] = await db.select().from(servers).limit(1)
    if (!server) return null
    if (server.instanceActorPublicKey && server.instanceActorPrivateKey) {
        return { publicKey: server.instanceActorPublicKey, privateKey: server.instanceActorPrivateKey }
    }

    const { publicKey, privateKey } = generateRsaKeyPair()
    await db.update(servers)
        .set({ instanceActorPublicKey: publicKey, instanceActorPrivateKey: privateKey })
        .where(eq(servers.id, server.id))
    return { publicKey, privateKey }
}
