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

        // 리다이렉트를 타면 실제로 요청이 도착한 곳이 서명 계산에 쓴 inboxUrl(host/path)과
        // 달라져서, HTTP 상태는 2xx로 와도 상대 서버의 서명 검증은 실패(비동기 처리라 우리
        // 쪽에 에러가 안 옴)할 수 있음 — "대기중"에서 멈추는 원인 중 하나라 명시적으로 실패 처리
        if (res.redirected && res.url !== inboxUrl) {
            console.error(`[deliver] 리다이렉트 감지, 서명 불일치 우려로 실패 처리 → ${inboxUrl} ⇒ ${res.url}`)
            return false
        }

        if (!res.ok) {
            const text = await res.text().catch(() => '')
            console.error(`[deliver] 실패 ${res.status} → ${inboxUrl}: ${text.slice(0, 200)}`)
        } else {
            console.log(`[deliver] 전송 성공 (HTTP ${res.status}) → ${inboxUrl} — 단, 상대 서버가 서명 검증을 비동기로 하는 경우가 많아 이 응답이 최종 수락을 보장하진 않음`)
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
