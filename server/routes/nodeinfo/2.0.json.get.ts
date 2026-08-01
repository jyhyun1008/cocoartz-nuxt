import { db } from '../../utils/db'
import { actors } from '../../db/schema'
import { count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    const [row] = await db.select({ total: count() }).from(actors)
    const userCount = row?.total ?? 0

    setHeader(event, 'Content-Type', 'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0"')
    return {
        version: '2.0',
        software: {
            name: 'cocoartz',
            version: '0.1.0',
        },
        protocols: ['activitypub'],
        usage: {
            users: { total: userCount, activeMonth: userCount, activeHalfyear: userCount },
            localPosts: 0,
        },
        openRegistrations: false,
    }
})
