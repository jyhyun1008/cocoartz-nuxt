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
