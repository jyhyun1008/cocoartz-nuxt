// 서버의 renderCustomEmoji(server/utils/ap/sanitize.ts)와 동일한 치환 로직의 클라이언트판.
// 로컬 게시글/채팅/위키/리액션은 원격과 달리 저장 시점이 아니라 "표시 시점"에 치환한다
// (이모지가 나중에 삭제/변경돼도 바로 반영되고, 4개 작성 API를 손댈 필요가 없어서 더 간단함)

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// html은 이미 렌더링된(marked.parse 등을 거친) HTML 문자열이거나, 리액션처럼 escapeHtml로
// 미리 이스케이프해둔 순수 텍스트여야 함 — 여기서는 :shortcode: 문자열 매칭/치환만 담당
export function renderCustomEmojiText(html: string, emojiMap: Record<string, string>): string {
    let result = html
    for (const shortcode of Object.keys(emojiMap)) {
        const token = `:${shortcode}:`
        if (!result.includes(token)) continue
        const url = emojiMap[shortcode]
        const safeUrl = url.replace(/"/g, '%22')
        const safeAlt = token.replace(/"/g, '&quot;')
        const img = `<img class="custom-emoji" src="${safeUrl}" alt="${safeAlt}" title="${safeAlt}" loading="lazy">`
        result = result.split(token).join(img)
    }
    return result
}
