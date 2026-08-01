import { db } from '../db'
import { actors } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { generateRsaKeyPair } from './crypto'

export async function ensureActor(userid: number) {
    const [existing] = await db.select().from(actors).where(eq(actors.userid, userid))
    if (existing) return existing

    const { publicKey, privateKey } = generateRsaKeyPair()
    const [actor] = await db.insert(actors).values({ userid, publicKey, privateKey })
        .onConflictDoNothing({ target: actors.userid })
        .returning()

    if (actor) return actor

    // 동시 요청으로 경합이 발생한 경우 이미 생성된 row를 반환
    const [created] = await db.select().from(actors).where(eq(actors.userid, userid))
    return created ?? null
}
