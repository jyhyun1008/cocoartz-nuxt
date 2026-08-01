import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { email } = await readBody(event)
    return db.select().from(users).where(eq(users.email, email))
})
