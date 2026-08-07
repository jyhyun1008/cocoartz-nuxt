import { isPublicUrl } from './urlUtils'

const DANGEROUS_TAGS = /script|style|iframe|frame|object|embed|form|input|button|link|meta|base/i

export function sanitizeHtml(html: string): string {
    return html
        // 위험한 태그 + 내용 제거
        .replace(new RegExp(`<(${DANGEROUS_TAGS.source})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi'), '')
        .replace(new RegExp(`<(${DANGEROUS_TAGS.source})\\b[^>]*/?>`, 'gi'), '')
        // 이벤트 핸들러 제거 (onclick, onerror 등)
        .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
        // javascript:/data:/vbscript: URL 제거
        .replace(/(href|src|action)\s*=\s*"(?:javascript|data|vbscript):[^"]*"/gi, '$1="#"')
        .replace(/(href|src|action)\s*=\s*'(?:javascript|data|vbscript):[^']*'/gi, "$1='#'")
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// 원격 액터의 표시 이름(Person.name)에 커스텀 이모지(:shortcode:)가 섞여 있을 때 이미지로 치환.
// name은 (content와 달리) 원래 HTML이 아니라 순수 텍스트라서 sanitizeHtml 대신 먼저 통째로
// escape한 뒤, 우리가 직접 만든 <img> 마커만 renderCustomEmoji로 끼워넣는다
// (그래야 악의적인 표시 이름에 <script> 같은 실제 태그가 섞여 있어도 무해한 텍스트로만 남음)
export function renderActorName(name: string, tag: unknown): string {
    return renderCustomEmoji(escapeHtml(name || ''), tag)
}

// AP Note의 tag 배열에 담긴 커스텀 이모지(type:'Emoji')로 본문 속 :shortcode: 텍스트를
// 실제 이미지로 치환. 미스키/마스토돈 등은 content HTML에 :shortcode: 문자열만 그대로 두고
// tag 쪽에 아이콘 URL을 따로 실어 보내서, 클라이언트(원래는 웹 UI)가 직접 치환하는 방식이라
// 우리 쪽도 저장 시점에 미리 치환해둠
export function renderCustomEmoji(html: string, tag: unknown): string {
    const list = Array.isArray(tag) ? tag : tag ? [tag] : []
    let result = html
    for (const t of list) {
        const emoji = t as any
        if (emoji?.type !== 'Emoji') continue
        const shortcode = typeof emoji.name === 'string' ? emoji.name : null
        const url = emoji.icon?.url
        if (!shortcode || typeof url !== 'string' || !isPublicUrl(url)) continue
        if (!result.includes(shortcode)) continue
        const safeUrl = url.replace(/"/g, '%22')
        const safeAlt = shortcode.replace(/"/g, '&quot;')
        const img = `<img class="custom-emoji" src="${safeUrl}" alt="${safeAlt}" title="${safeAlt}" loading="lazy">`
        result = result.split(shortcode).join(img)
    }
    return result
}

// 우리 서버 커스텀 이모지를 연합으로 내보낼 때(publishPost.ts) 본문에 실제로 등장하는
// :shortcode: 만 골라 AP tag 배열 항목으로 변환. 본문 텍스트 자체는 건드리지 않고(리터럴
// :shortcode: 유지) 이미지 정보만 별도로 실어 보내는 마스토돈/미스키 관례를 그대로 따름
export function buildOutgoingEmojiTags(
    domain: string,
    text: string,
    emojis: Array<{ shortcode: string; imageUrl: string; imageType: string }>,
): unknown[] {
    return emojis
        .filter((e) => text.includes(`:${e.shortcode}:`))
        .map((e) => ({
            id: `https://${domain}/emojis/${e.shortcode}`,
            type: 'Emoji',
            name: `:${e.shortcode}:`,
            updated: new Date().toISOString(),
            icon: { type: 'Image', mediaType: e.imageType, url: e.imageUrl },
        }))
}

// AP Note의 attachment(첨부) 배열에서 이미지만 뽑아 <img> 태그로 반환.
// 파일(비디오/문서 등)은 스킵 — 갤러리 컴포넌트 없이 마크다운 ![]() 수준의 단순 인라인 이미지로만 표시
export function extractImageAttachmentsHtml(attachment: unknown): string {
    const list = Array.isArray(attachment) ? attachment : attachment ? [attachment] : []
    return list
        .filter((a: any) => {
            const mediaType = a?.mediaType as string | undefined
            return (a?.type === 'Image' || a?.type === 'Document') && !!mediaType?.startsWith('image/')
        })
        .filter((a: any) => typeof a?.url === 'string' && isPublicUrl(a.url))
        .map((a: any) => {
            const url = String(a.url).replace(/"/g, '%22')
            const alt = String(a.name ?? '').replace(/"/g, '&quot;')
            return `<p><img src="${url}" alt="${alt}" loading="lazy"></p>`
        })
        .join('')
}
