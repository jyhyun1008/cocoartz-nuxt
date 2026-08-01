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

    // "timeline"은 실제 유저가 아니라 연합 타임라인 전용 서비스 액터를 위한 예약어
    if (username === 'timeline') {
        setHeader(event, 'Content-Type', 'application/jrd+json')
        return {
            subject: `acct:timeline@${domain}`,
            links: [
                {
                    rel: 'self',
                    type: 'application/activity+json',
                    href: `https://${domain}/ap/timeline`,
                },
                {
                    rel: 'http://webfinger.net/rel/profile-page',
                    type: 'text/html',
                    href: `https://${domain}/timeline`,
                },
            ],
        }
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
