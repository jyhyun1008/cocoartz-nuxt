// 인용글 카드/링크 미리보기 카드가 이미 따로 붙어 보여주니, 본문 안에 있는 그 링크
// (quoteUrl/linkUrl과 일치하는 <a href>)는 텍스트로 중복 노출할 필요가 없어서 지워줌 —
// 지우고 남는 빈 문단/줄바꿈도 같이 정리해서 부자연스러운 여백이 안 남게 함
export function stripEmbeddedLink(html: string, url?: string | null): string {
    if (!html || !url) return html
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let result = html.replace(new RegExp(`<a\\s[^>]*href=["']${escaped}["'][^>]*>[\\s\\S]*?</a>`, 'gi'), '')
    result = result.replace(/<p>\s*<\/p>/gi, '')
    result = result.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>')
    return result.trim()
}
