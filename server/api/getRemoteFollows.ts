import { db } from '../utils/db'
import { remoteFollows } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { getOptionalUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const userid = await getOptionalUserId(event)
    if (!userid) return []
    return db.select().from(remoteFollows)
        .where(eq(remoteFollows.userid, userid))
        .orderBy(desc(remoteFollows.createdAt))
})
