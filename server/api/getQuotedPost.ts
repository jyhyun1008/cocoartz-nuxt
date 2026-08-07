import { fetchObject, fetchActor, buildActorDisplayInfo } from '../utils/ap/activitypub'
import { sanitizeHtml, extractImageAttachmentsHtml, renderCustomEmoji } from '../utils/ap/sanitize'

// 인용(quote)한 원본 글을 라이브로 가져와서 상세 화면의 인용 카드에 쓸 가벼운 미리보기로
// 반환. DB에 영구 저장하지 않음 — 대상은 이미 AP 오브젝트라 fetchObject 자체가 가볍고,
// 캐시 테이블을 더 늘리지 않기 위함. 인증 불필요(비로그인 연합 게시판 조회에도 필요)
export default eventHandler(async (event) => {
    const { quoteUrl } = await readBody(event)
    if (!quoteUrl || typeof quoteUrl !== 'string') return null

    const object = await fetchObject(quoteUrl)
    if (!object || object.type !== 'Note') return null

    const attributedTo = typeof object.attributedTo === 'string' ? object.attributedTo : null
    if (!attributedTo) return null
    const authorData = await fetchActor(attributedTo)
    if (!authorData) return null

    const info = buildActorDisplayInfo(authorData, attributedTo)
    const content = renderCustomEmoji(sanitizeHtml(object.content as string || ''), object.tag) + extractImageAttachmentsHtml(object.attachment)
    const summary = typeof object.summary === 'string' ? renderCustomEmoji(sanitizeHtml(object.summary), object.tag).trim() || null : null

    return {
        objectId: typeof object.id === 'string' ? object.id : quoteUrl,
        content,
        summary,
        sourceActorUrl: attributedTo,
        sourceName: info.name,
        sourceHandle: info.handle,
        sourceIconUrl: info.iconUrl,
    }
})
