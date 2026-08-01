import { db } from '../../../utils/db'
import { users, actors, posts } from '../../../db/schema'
import { eq, and, isNotNull, isNull, desc } from 'drizzle-orm'
import { actorUrl, buildCreateActivity, AP_CONTENT_TYPE } from '../../../utils/ap/activitypub'
import { marked } from 'marked'

export default defineEventHandler(async (event) => {
    const username = getRouterParam(event, 'username')!
    const config = useRuntimeConfig()
    const domain = config.domain as string

    const [user] = await db.select().from(users).where(eq(users.username, username))
    if (!user) throw createError({ statusCode: 404, message: '존재하지 않는 유저입니다' })

    const [actor] = await db.select().from(actors).where(eq(actors.userid, user.id))
    if (!actor) throw createError({ statusCode: 404, message: '연합에 참여하지 않은 유저입니다' })

    const rows = await db.select().from(posts)
        .where(and(
            eq(posts.userid, user.id),
            isNotNull(posts.objectId),
            isNull(posts.replyto),
        ))
        .orderBy(desc(posts.createdAt))
        .limit(20)

    const base = actorUrl(domain, username)
    const items = rows.map((p) => buildCreateActivity(domain, username, {
        objectId: p.objectId!,
        content: String(marked.parse(p.content)),
        published: p.createdAt,
        summary: p.title,
    }))

    setHeader(event, 'Content-Type', AP_CONTENT_TYPE)
    return {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'OrderedCollection',
        id: `${base}/outbox`,
        totalItems: items.length,
        orderedItems: items,
    }
})
