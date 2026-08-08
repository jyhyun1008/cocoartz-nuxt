import { db } from '../utils/db'
import { wordMutes } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

// 단어/정규식 뮤트 관리(해제) 목록용
export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) return []

    return db.select().from(wordMutes).where(eq(wordMutes.userid, userid)).orderBy(desc(wordMutes.createdAt))
})
