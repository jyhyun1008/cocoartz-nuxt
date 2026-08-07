import { isPublicUrl } from './urlUtils'

export const AP_CONTENT_TYPE = 'application/activity+json'
export const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams'
export const SECURITY_CONTEXT = 'https://w3id.org/security/v1'
export const AS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'

// object(Note)의 to/cc, 없으면 activity(Create 등) 레벨의 to/cc를 확인해서
// AS_PUBLIC이 하나라도 있으면 공개(공개/Unlisted)로 취급. 팔로워 공개, Misskey 홈 공개,
// 다이렉트 등은 어디에도 Public이 없으므로 거부됨.
export function isPublicAudience(object: Record<string, unknown>, activity?: Record<string, unknown>): boolean {
    const toArrays = [object.to, object.cc, activity?.to, activity?.cc]
    for (const field of toArrays) {
        const list = Array.isArray(field) ? field : field ? [field] : []
        if (list.includes(AS_PUBLIC)) return true
    }
    return false
}

export function actorUrl(domain: string, username: string) {
    return `https://${domain}/users/${username}`
}

export function postObjectUrl(domain: string, username: string, postId: number) {
    return `${actorUrl(domain, username)}/posts/${postId}`
}

// 우리 서버가 발급한 objectId(https://{domain}/users/{username}/posts/{id})에서 postid만 추출
export function parseLocalPostId(domain: string, objectId: string): number | null {
    const re = new RegExp(`^https://${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/users/[^/]+/posts/(\\d+)$`)
    const m = objectId.match(re)
    if (!m) return null
    const id = Number(m[1])
    return Number.isFinite(id) ? id : null
}

export function buildActorObject(domain: string, actor: {
    id: string
    profileUrl?: string
    preferredUsername: string
    name: string
    summary?: string | null
    avatar?: string | null
    publicKey: string
    type?: 'Person' | 'Service'
}) {
    const base = actor.id
    return {
        '@context': [AS_CONTEXT, SECURITY_CONTEXT],
        type: actor.type ?? 'Person',
        id: base,
        url: actor.profileUrl ?? base,
        preferredUsername: actor.preferredUsername,
        name: actor.name,
        summary: actor.summary || '',
        inbox: `${base}/inbox`,
        outbox: `${base}/outbox`,
        followers: `${base}/followers`,
        ...(actor.avatar ? { icon: { type: 'Image', url: actor.avatar } } : {}),
        publicKey: {
            id: `${base}#main-key`,
            owner: base,
            publicKeyPem: actor.publicKey,
        },
    }
}

export function buildCreateActivity(domain: string, username: string, note: {
    objectId: string
    content: string
    published: Date
    inReplyTo?: string | null
    summary?: string | null
    attachment?: unknown[]
    tag?: unknown[]
    to?: string[]
    cc?: string[]
}) {
    const base = actorUrl(domain, username)
    return {
        '@context': AS_CONTEXT,
        id: `${note.objectId}/activity`,
        type: 'Create',
        actor: base,
        published: note.published.toISOString(),
        to: note.to ?? [AS_PUBLIC],
        cc: note.cc ?? [`${base}/followers`],
        object: {
            id: note.objectId,
            type: 'Note',
            attributedTo: base,
            content: note.content,
            // summary = 마스토돈 등에서 CW(열람주의) 문구로 취급되는 필드. 있으면 본문이 접혀서 보임
            summary: note.summary ?? null,
            sensitive: !!note.summary,
            attachment: note.attachment ?? [],
            // 본문에 등장하는 :shortcode: 커스텀 이모지 — 우리 인바운드 파서(renderCustomEmoji)가
            // 기대하는 것과 동일한 형태(content엔 리터럴 텍스트, tag에 이미지 정보)로 내보냄
            tag: note.tag ?? [],
            published: note.published.toISOString(),
            inReplyTo: note.inReplyTo ?? null,
            to: note.to ?? [AS_PUBLIC],
            cc: note.cc ?? [`${base}/followers`],
        },
    }
}

export function buildAcceptActivity(domain: string, username: string, followActivity: unknown) {
    const base = actorUrl(domain, username)
    return {
        '@context': AS_CONTEXT,
        type: 'Accept',
        id: `${base}#accept-${Date.now()}`,
        actor: base,
        object: followActivity,
    }
}

export function buildRejectActivity(domain: string, username: string, followActivity: unknown) {
    const base = actorUrl(domain, username)
    return {
        '@context': AS_CONTEXT,
        type: 'Reject',
        id: `${base}#reject-${Date.now()}`,
        actor: base,
        object: followActivity,
    }
}

export function buildLikeActivity(domain: string, username: string, objectId: string) {
    const base = actorUrl(domain, username)
    return {
        '@context': AS_CONTEXT,
        type: 'Like',
        id: `${base}#like-${Date.now()}`,
        actor: base,
        object: objectId,
    }
}

export function buildDeleteActivity(domain: string, username: string, objectId: string) {
    const base = actorUrl(domain, username)
    return {
        '@context': AS_CONTEXT,
        id: `${objectId}/delete`,
        type: 'Delete',
        actor: base,
        to: [AS_PUBLIC],
        object: {
            id: objectId,
            type: 'Tombstone',
        },
    }
}

export function buildFollowActivity(actorId: string, targetActorUrl: string) {
    return {
        '@context': AS_CONTEXT,
        type: 'Follow',
        id: `${actorId}#follow-${Date.now()}`,
        actor: actorId,
        object: targetActorUrl,
    }
}

export function buildUndoActivity(actorId: string, activity: unknown) {
    return {
        '@context': AS_CONTEXT,
        type: 'Undo',
        id: `${actorId}#undo-${Date.now()}`,
        actor: actorId,
        object: activity,
    }
}

export async function fetchActor(url: string): Promise<Record<string, unknown> | null> {
    if (!isPublicUrl(url)) {
        console.warn(`[fetchActor] 차단: ${url}`)
        return null
    }
    try {
        const res = await fetch(url, { headers: { Accept: AP_CONTENT_TYPE } })
        if (!res.ok) return null
        return await res.json() as Record<string, unknown>
    } catch {
        return null
    }
}

// 부스트(Announce)의 대상처럼, 임의의 원격 오브젝트(Note 등)를 URL로 직접 가져올 때 사용 —
// fetchActor와 완전히 동일한 패턴(서명 없는 GET + SSRF 차단)
export async function fetchObject(url: string): Promise<Record<string, unknown> | null> {
    if (!isPublicUrl(url)) {
        console.warn(`[fetchObject] 차단: ${url}`)
        return null
    }
    try {
        const res = await fetch(url, { headers: { Accept: AP_CONTENT_TYPE } })
        if (!res.ok) return null
        return await res.json() as Record<string, unknown>
    } catch {
        return null
    }
}

export async function resolveWebfinger(resource: string): Promise<string | null> {
    const match = resource.match(/^@?([^@]+)@(.+)$/)
    if (!match) return null
    const [, user, host] = match
    try {
        const res = await fetch(
            `https://${host}/.well-known/webfinger?resource=acct:${user}@${host}`,
            { headers: { Accept: 'application/jrd+json' } },
        )
        if (!res.ok) return null
        const data = await res.json() as { links?: Array<{ rel: string; href: string }> }
        const link = data.links?.find((l) => l.rel === 'self')
        return link?.href || null
    } catch {
        return null
    }
}
