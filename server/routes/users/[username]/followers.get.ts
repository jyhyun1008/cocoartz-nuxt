import { db } from '../../../utils/db'
import { users, actors, follows } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { actorUrl, AP_CONTENT_TYPE } from '../../../utils/ap/activitypub'

export default defineEventHandler(async (event) => {
    const username = getRouterParam(event, 'username')!
    const config = useRuntimeConfig()

    const [user] = await db.select().from(users).where(eq(users.username, username))
    if (!user) throw createError({ statusCode: 404, message: '존재하지 않는 유저입니다' })

    const [actor] = await db.select().from(actors).where(eq(actors.userid, user.id))
    if (!actor) throw createError({ statusCode: 404, message: '연합에 참여하지 않은 유저입니다' })

    const followerRows = await db.select().from(follows)
        .where(and(eq(follows.userid, user.id), eq(follows.accepted, true)))

    const base = actorUrl(config.domain as string, username)
    setHeader(event, 'Content-Type', AP_CONTENT_TYPE)
    return {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'OrderedCollection',
        id: `${base}/followers`,
        totalItems: followerRows.length,
        orderedItems: followerRows.map((f) => f.followerActorUrl),
    }
})
