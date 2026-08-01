import { db } from '../utils/db'
import { rooms } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { path } = await readBody(event)
    return db.select().from(rooms).where(eq(rooms.path, path))
})
