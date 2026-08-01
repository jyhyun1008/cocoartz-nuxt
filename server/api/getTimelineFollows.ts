import { db } from '../utils/db'
import { timelineFollows } from '../db/schema'
import { desc } from 'drizzle-orm'

export default eventHandler(async () => {
    return db.select().from(timelineFollows).orderBy(desc(timelineFollows.createdAt))
})
