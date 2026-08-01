import { db } from '../utils/db'
import { rooms } from '../db/schema'

export default eventHandler(async () => {
    return db.select().from(rooms)
})
