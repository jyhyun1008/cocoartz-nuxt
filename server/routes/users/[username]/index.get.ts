import { db } from '../../../utils/db'
import { users, actors } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { buildActorObject, actorUrl, AP_CONTENT_TYPE } from '../../../utils/ap/activitypub'

export default defineEventHandler(async (event) => {
    const username = getRouterParam(event, 'username')!
    const config = useRuntimeConfig()
    const domain = config.domain as string

    const [user] = await db.select().from(users).where(eq(users.username, username))
    if (!user) throw createError({ statusCode: 404, message: '존재하지 않는 유저입니다' })

    const [actor] = await db.select().from(actors).where(eq(actors.userid, user.id))
    if (!actor) throw createError({ statusCode: 404, message: '연합에 참여하지 않은 유저입니다' })

    setHeader(event, 'Content-Type', AP_CONTENT_TYPE)
    return buildActorObject(domain, {
        id: actorUrl(domain, user.username),
        profileUrl: `https://${domain}/@${user.username}`,
        preferredUsername: user.username,
        name: user.knownas || user.username,
        summary: user.bio,
        avatar: user.avatar,
        banner: user.banner,
        publicKey: actor.publicKey,
    })
})
