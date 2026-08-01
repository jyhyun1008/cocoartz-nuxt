import { db } from '../utils/db'
import { timelinePosts } from '../db/schema'
import { desc } from 'drizzle-orm'

export default eventHandler(async () => {
    return db.select().from(timelinePosts).orderBy(desc(timelinePosts.published)).limit(50)
})
