import { db } from '../utils/db'
import { servers } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { slug } = await readBody(event)
    return db.select().from(servers).where(eq(servers.slug, slug))
})
