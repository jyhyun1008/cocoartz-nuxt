// 인용글 카드/링크 미리보기 카드가 이미 따로 붙어 보여주니, 본문 안에 있는 그 링크
// (quoteUrl/linkUrl과 일치하는 <a href>)는 텍스트로 중복 노출할 필요가 없어서 지워줌 —
// 미스키 등은 인용 링크 앞에 "RE:" 같은 표시를 텍스트로 붙여두는 관례가 있어서 같이 지우고,
// 지우고 남는 빈 문단/"RE:"만 남은 줄/중복 줄바꿈도 같이 정리해서 부자연스러운 여백이 안 남게 함
export function stripEmbeddedLink(html: string, url?: string | null): string {
    if (!html || !url) return html
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let result = html
        // "RE: <a href="...">...</a>" — RE: 표시가 링크 바로 앞에 텍스트로 붙어있는 경우
        .replace(new RegExp(`(?:RE:?\\s*)?<a\\s[^>]*href=["']${escaped}["'][^>]*>[\\s\\S]*?</a>`, 'gi'), '')
        // 링크로 안 감싸고 "RE: https://..." 순수 텍스트로만 붙어있는 경우
        .replace(new RegExp(`RE:?\\s*${escaped}`, 'gi'), '')
    result = result.replace(/<p>\s*(?:RE:?\s*)?<\/p>/gi, '')
    result = result.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>')
    return result.trim()
}
