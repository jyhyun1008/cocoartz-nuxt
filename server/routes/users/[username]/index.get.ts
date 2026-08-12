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
    // 탈퇴한 계정 — 마스토돈 등 표준 구현체가 삭제된 액터 키 재조회 요청에 하는 것과 동일하게
    // 410 Gone으로 응답함(404와 구분: "원래 없던 게 아니라 있었는데 없어졌다"는 뜻이 명확해짐)
    if (user.deletedAt) throw createError({ statusCode: 410, message: '탈퇴한 계정입니다' })

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
