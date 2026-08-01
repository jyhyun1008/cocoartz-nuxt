import { db } from '../../../utils/db'
import { timelineFollows, timelinePosts } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { fetchActor } from '../../../utils/ap/activitypub'
import { verifyInboxSignature, extractSignatureDomain } from '../../../utils/ap/httpSignature'
import { sanitizeHtml } from '../../../utils/ap/sanitize'
import { checkRateLimit } from '../../../utils/ap/rateLimit'

const MAX_INBOX_REQUESTS_PER_MINUTE = 60

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const domain = config.domain as string

    const sigHeader = getRequestHeader(event, 'signature')
    const remoteKey =
        extractSignatureDomain(sigHeader)
        ?? getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
        ?? getRequestHeader(event, 'x-real-ip')
        ?? 'unknown'

    if (!checkRateLimit(`timeline-inbox:${remoteKey}`, MAX_INBOX_REQUESTS_PER_MINUTE, 60_000)) {
        throw createError({ statusCode: 429, message: '요청이 너무 많습니다' })
    }

    const rawBody = await readRawBody(event) ?? new Uint8Array()
    let body: Record<string, unknown>
    try {
        body = JSON.parse(Buffer.from(rawBody).toString('utf-8'))
    } catch {
        throw createError({ statusCode: 400, message: '잘못된 요청' })
    }

    if (!sigHeader) throw createError({ statusCode: 401, message: '서명이 필요합니다' })
    const url = getRequestURL(event)
    const sigOk = await verifyInboxSignature(
        sigHeader, 'POST', url.pathname,
        (h) => getRequestHeader(event, h), rawBody, domain,
    )
    if (!sigOk) throw createError({ statusCode: 401, message: '서명 검증 실패' })

    switch (body.type) {
        case 'Accept':
            await handleAccept(body)
            break
        case 'Reject':
            await handleReject(body)
            break
        case 'Create':
            await handleCreate(body)
            break
        case 'Delete':
            await handleDelete(body)
            break
        case 'Update':
            await handleUpdate(body)
            break
        default:
            break
    }

    return { status: 'ok' }
})

async function handleAccept(body: Record<string, unknown>) {
    const object = body.object as Record<string, unknown> | string | undefined
    if (!object || typeof object !== 'object' || object.type !== 'Follow') return
    const followActivityId = object.id as string | undefined
    const actorUrl_ = body.actor as string
    if (!followActivityId && !actorUrl_) return

    await db.update(timelineFollows)
        .set({ accepted: true })
        .where(followActivityId ? eq(timelineFollows.followActivityId, followActivityId) : eq(timelineFollows.targetActorUrl, actorUrl_))
}

async function handleReject(body: Record<string, unknown>) {
    const object = body.object as Record<string, unknown> | string | undefined
    if (!object || typeof object !== 'object' || object.type !== 'Follow') return
    const followActivityId = object.id as string | undefined
    if (!followActivityId) return
    await db.delete(timelineFollows).where(eq(timelineFollows.followActivityId, followActivityId))
}

async function handleCreate(body: Record<string, unknown>) {
    const object = body.object as Record<string, unknown>
    if (!object || object.type !== 'Note') return

    const objectId = typeof object.id === 'string' ? object.id : null
    const actorUrl_ = body.actor as string
    if (!objectId || !actorUrl_) return

    const [follow] = await db.select().from(timelineFollows)
        .where(eq(timelineFollows.targetActorUrl, actorUrl_))
    if (!follow?.accepted) return

    const [existing] = await db.select().from(timelinePosts).where(eq(timelinePosts.objectId, objectId))
    if (existing) return

    const content = sanitizeHtml(object.content as string || '')
    if (!content) return

    await db.insert(timelinePosts).values({
        sourceActorUrl: actorUrl_,
        sourceHandle: follow.targetHandle,
        sourceName: follow.targetName,
        sourceIconUrl: follow.targetIconUrl,
        objectId,
        content,
        published: new Date((object.published as string) || Date.now()),
    })
}

async function handleDelete(body: Record<string, unknown>) {
    const actorUrl_ = body.actor as string | undefined
    if (!actorUrl_) return
    await db.delete(timelineFollows).where(eq(timelineFollows.targetActorUrl, actorUrl_))
    await db.delete(timelinePosts).where(eq(timelinePosts.sourceActorUrl, actorUrl_))
}

async function handleUpdate(body: Record<string, unknown>) {
    const object = body.object as Record<string, unknown>
    if (!object || typeof object !== 'object') return
    const type = object.type as string
    if (!['Person', 'Service', 'Application', 'Group', 'Organization'].includes(type)) return

    const actorUrl_ = (object.id || body.actor) as string
    if (!actorUrl_) return

    const actorData = await fetchActor(actorUrl_)
    if (!actorData) return

    const preferredUsername = actorData.preferredUsername as string || ''
    const actorDomain = new URL(actorUrl_).hostname
    const name = (actorData.name as string) || preferredUsername
    const handle = preferredUsername ? `@${preferredUsername}@${actorDomain}` : ''
    const iconUrl = (actorData.icon as Record<string, string> | undefined)?.url || ''

    await db.update(timelineFollows)
        .set({ targetName: name, targetHandle: handle, targetIconUrl: iconUrl })
        .where(eq(timelineFollows.targetActorUrl, actorUrl_))
    await db.update(timelinePosts)
        .set({ sourceName: name, sourceHandle: handle, sourceIconUrl: iconUrl })
        .where(eq(timelinePosts.sourceActorUrl, actorUrl_))
}
