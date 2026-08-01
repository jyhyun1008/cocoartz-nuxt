import { db } from '../../utils/db'
import { users, actors } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const resource = query.resource as string | undefined

    if (!resource?.startsWith('acct:')) {
        throw createError({ statusCode: 400, message: 'resource 파라미터가 필요합니다' })
    }

    const config = useRuntimeConfig()
    const domain = config.domain as string

    const acct = resource.slice(5) // "acct:" 제거
    const [username, host] = acct.split('@') as [string | undefined, string | undefined]

    if (!username || host !== domain) {
        throw createError({ statusCode: 404, message: '이 도메인의 계정이 아닙니다' })
    }

    const [user] = await db.select().from(users).where(eq(users.username, username))
    if (!user) throw createError({ statusCode: 404, message: '존재하지 않는 계정입니다' })

    const [actor] = await db.select().from(actors).where(eq(actors.userid, user.id))
    if (!actor) throw createError({ statusCode: 404, message: '연합에 참여하지 않은 계정입니다' })

    setHeader(event, 'Content-Type', 'application/jrd+json')
    return {
        subject: `acct:${username}@${domain}`,
        links: [
            {
                rel: 'self',
                type: 'application/activity+json',
                href: `https://${domain}/users/${username}`,
            },
            {
                rel: 'http://webfinger.net/rel/profile-page',
                type: 'text/html',
                href: `https://${domain}/@${username}`,
            },
        ],
    }
})
