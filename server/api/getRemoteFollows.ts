import { db } from '../utils/db'
import { remoteFollows } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { userid } = await readBody(event)
    if (!userid) return []
    return db.select().from(remoteFollows)
        .where(eq(remoteFollows.userid, userid))
        .orderBy(desc(remoteFollows.createdAt))
})
