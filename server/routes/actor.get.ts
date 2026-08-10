import { buildActorObject, AP_CONTENT_TYPE } from '../utils/ap/activitypub'
import { ensureInstanceActor } from '../utils/ap/instanceActor'

// 서버 자체를 대표하는 "인스턴스 액터"(마스토돈의 /actor와 동일한 개념) — 특정 유저 소유가 아닌
// 조회성 GET 요청(activitypub.ts의 buildOutboundGetHeaders)에 서명할 때 쓰는 키페어의 주인.
// 마스토돈 등 "Authorized fetch"(시큐어 모드) 상대 서버가 우리가 보낸 서명의 keyId
// (https://{domain}/actor#main-key)를 실제로 조회해서 publicKey를 검증할 수 있어야 하므로 노출함.
export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const domain = config.domain as string

    const keypair = await ensureInstanceActor()
    if (!keypair) throw createError({ statusCode: 404, message: '인스턴스 액터가 아직 준비되지 않았습니다' })

    setHeader(event, 'Content-Type', AP_CONTENT_TYPE)
    return buildActorObject(domain, {
        id: `https://${domain}/actor`,
        preferredUsername: 'instance.actor',
        name: '인스턴스 액터',
        publicKey: keypair.publicKey,
        type: 'Application',
    })
})
