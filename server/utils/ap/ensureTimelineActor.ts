import { db } from '../db'
import { timelineActor } from '../../db/schema'
import { asc } from 'drizzle-orm'
import { generateRsaKeyPair } from './crypto'

// timelineActor는 서버 전체에 하나만 존재하는 싱글턴 (지연 생성)
export async function ensureTimelineActor() {
    const [existing] = await db.select().from(timelineActor).orderBy(asc(timelineActor.id)).limit(1)
    if (existing) return existing

    const { publicKey, privateKey } = generateRsaKeyPair()
    await db.insert(timelineActor).values({ publicKey, privateKey })

    const [created] = await db.select().from(timelineActor).orderBy(asc(timelineActor.id)).limit(1)
    return created ?? null
}
