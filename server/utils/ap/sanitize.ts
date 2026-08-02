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
