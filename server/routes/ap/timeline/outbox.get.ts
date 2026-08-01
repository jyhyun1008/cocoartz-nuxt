import { timelineActorUrl, AP_CONTENT_TYPE } from '../../../utils/ap/activitypub'

// @timeline은 직접 글을 작성하지 않고 외부 글을 받아모으기만 함
export default defineEventHandler((event) => {
    const config = useRuntimeConfig()
    const domain = config.domain as string
    const base = timelineActorUrl(domain)

    setHeader(event, 'Content-Type', AP_CONTENT_TYPE)
    return {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'OrderedCollection',
        id: `${base}/outbox`,
        totalItems: 0,
        orderedItems: [],
    }
})
