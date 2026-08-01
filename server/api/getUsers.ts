import { db } from '../utils/db'
import { users } from '../db/schema'

export default eventHandler(async () => {
    return db.select().from(users)
})
