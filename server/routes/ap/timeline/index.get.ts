import { ensureTimelineActor } from '../../../utils/ap/ensureTimelineActor'
import { buildActorObject, timelineActorUrl, AP_CONTENT_TYPE } from '../../../utils/ap/activitypub'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const domain = config.domain as string

    const actor = await ensureTimelineActor()
    if (!actor) throw createError({ statusCode: 500, message: '타임라인 액터 생성 실패' })

    setHeader(event, 'Content-Type', AP_CONTENT_TYPE)
    return buildActorObject(domain, {
        id: timelineActorUrl(domain),
        profileUrl: `https://${domain}/timeline`,
        preferredUsername: 'timeline',
        name: '연합 타임라인',
        summary: '이 서버가 구독하는 외부 fediverse 계정들의 글을 모아옵니다.',
        publicKey: actor.publicKey,
        type: 'Service',
    })
})
