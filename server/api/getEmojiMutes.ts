import { db } from '../utils/db'
import { emojiMutes } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { getOptionalUserId } from '../utils/session'

// 커스텀 이모지 뮤트 관리(해제) 목록용
export default eventHandler(async (event) => {
    const userid = await getOptionalUserId(event)
    if (!userid) return []

    return db.select().from(emojiMutes).where(eq(emojiMutes.userid, userid)).orderBy(desc(emojiMutes.createdAt))
})
