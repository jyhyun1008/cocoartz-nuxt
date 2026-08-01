import { timelineActorUrl, AP_CONTENT_TYPE } from '../../../utils/ap/activitypub'

// @timeline은 팔로우를 "받는" 계정이 아니라 외부를 팔로우"하는" 계정이라 팔로워는 항상 비어있음
export default defineEventHandler((event) => {
    const config = useRuntimeConfig()
    const domain = config.domain as string
    const base = timelineActorUrl(domain)

    setHeader(event, 'Content-Type', AP_CONTENT_TYPE)
    return {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'OrderedCollection',
        id: `${base}/followers`,
        totalItems: 0,
        orderedItems: [],
    }
})
