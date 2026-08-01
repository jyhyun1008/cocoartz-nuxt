import { buildSignedHeaders } from './crypto'

export async function deliverToInbox(
    inboxUrl: string,
    activity: unknown,
    senderActorId: string,
    privateKeyPem: string,
): Promise<boolean> {
    const keyId = `${senderActorId}#main-key`
    const body = JSON.stringify(activity)

    const headers = buildSignedHeaders(privateKeyPem, keyId, 'POST', inboxUrl, body)

    try {
        const res = await fetch(inboxUrl, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/activity+json' },
            body,
        })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            console.error(`[deliver] 실패 ${res.status} → ${inboxUrl}: ${text.slice(0, 200)}`)
        }
        return res.ok
    } catch (e) {
        console.error(`[deliver] 오류 → ${inboxUrl}:`, e)
        return false
    }
}

export async function deliverToFollowers(
    followers: Array<{ followerInbox: string }>,
    activity: unknown,
    senderActorId: string,
    privateKeyPem: string,
): Promise<void> {
    await Promise.allSettled(
        followers.map((f) =>
            deliverToInbox(f.followerInbox, activity, senderActorId, privateKeyPem),
        ),
    )
}
