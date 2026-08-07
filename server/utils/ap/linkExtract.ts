// 인용(quote) 대상 URL과 본문 속 첫 번째 일반 링크를 뽑아내는 유틸.
//
// 인용글 규격은 마스토돈/미스키 등 구현체마다 필드명이 다르고(FEP-e232 계열이 아직 여러
// 버전이 혼재) 완전히 정착된 상태가 아니라서, 알려진 필드명을 순서대로 방어적으로 체크한다.
// 여기서 못 잡아내는 구현체가 있을 수 있는데, 그런 경우에도 호환을 위해 본문 끝에 인용
// 링크를 텍스트로도 넣어주는 관례가 있어서 최소한 "링크"로는 잡힐 가능성이 높다.

function asHref(value: unknown): string | null {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
        const v = value as Record<string, unknown>
        if (typeof v.id === 'string') return v.id
        if (typeof v.href === 'string') return v.href
    }
    return null
}

export function extractQuoteUrl(object: Record<string, unknown>): string | null {
    return (
        asHref(object.quoteUrl) ||
        asHref(object.quoteUri) ||
        asHref(object._misskey_quote) ||
        asHref(object.quote) ||
        null
    )
}

// 이미 sanitizeHtml을 거친 content HTML에서 <a href="..."> 를 순서대로 찾아 첫 번째 것을 반환.
// excludeUrl과 같은 링크(인용 URL이 본문에도 그대로 링크로 들어있는 경우)는 건너뜀
export function extractFirstLink(contentHtml: string, excludeUrl?: string | null): string | null {
    const re = /<a\s[^>]*href=["']([^"']+)["']/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(contentHtml))) {
        const url = match[1]
        if (url && url !== excludeUrl && /^https?:\/\//i.test(url)) return url
    }
    return null
}
