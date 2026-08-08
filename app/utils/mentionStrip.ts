// 마스토돈/미스키 같은 마이크로블로그 클라이언트는 답글을 쓸 때 "누구에게 보내는 답글인지"를
// 본문 맨 앞에 자동으로 멘션(들)로 붙여줌(스레드 맥락이 곧 대화 상대 표시라서 마이크로블로그에선
// 필요함). 근데 여긴 게시판이라 답글이 이미 그 게시글 아래 "댓글"로 붙어서 보이니, 맨 앞의 그
// 멘션들은 항상 중복 노이즈임 — DB에 저장된 원문은 그대로 두고(나중에 다른 화면/연합으로 다시
// 내보낼 수도 있으니) "표시할 때만" 걷어냄. 문장 중간에 유저가 일부러 넣은 @멘션은 안 건드림
const LEADING_MENTION = new RegExp(
    '^(?:\\s|&nbsp;)*(?:'
    // <span class="h-card">...<a ...>@<span>user</span></a></span> (마스토돈 표준 형태)
    + '<span[^>]*class="[^"]*h-card[^"]*"[^>]*>\\s*<a[^>]*>\\s*@?\\s*(?:<span[^>]*>)?[^<]*(?:</span>)?\\s*</a>\\s*</span>'
    // h-card 스팬 없이 <a class="...mention...">@user@domain</a>만 오는 형태(미스키 등)
    + '|<a[^>]*class="[^"]*mention[^"]*"[^>]*>\\s*@[^<]*</a>'
    // 아예 순수 텍스트로 @user 또는 @user@domain
    + '|@[\\w.-]+(?:@[\\w.-]+)?'
    + ')(?:\\s|&nbsp;)*',
    'i',
)

export function stripLeadingMentions(html: string): string {
    if (!html) return html
    const pMatch = html.match(/^\s*<p[^>]*>/i)
    const prefix = pMatch ? pMatch[0] : ''
    let rest = html.slice(prefix.length)

    let changed = false
    while (LEADING_MENTION.test(rest)) {
        rest = rest.replace(LEADING_MENTION, '')
        changed = true
    }
    if (!changed) return html

    // 멘션만 있고 실제 본문이 없던 답글(순수 "확인!" 같은 리액션성 답글)이면 통째로 비워버리지
    // 않고 원문 그대로 둠 — 빈 댓글이 뜨는 것보단 멘션이 한 번 보이는 게 나음
    const textOnly = rest.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim()
    if (!textOnly) return html

    return prefix + rest
}
