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
