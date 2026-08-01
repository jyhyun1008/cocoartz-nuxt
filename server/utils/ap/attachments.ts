export type ApImageAttachment = {
    type: 'Image'
    mediaType: string
    url: string
    name?: string
}

const EXT_MEDIA_TYPE: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
}

function guessImageMediaType(url: string): string {
    const ext = url.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase() ?? ''
    return EXT_MEDIA_TYPE[ext] ?? 'image/jpeg'
}

// 마크다운 ![alt](url) 이미지 구문을 본문에서 떼어내고 AP attachment 배열로 변환.
// 원격에서 본문 안에 이미지가 그대로 남아있지 않고, 진짜 첨부파일처럼 별도 취급되게 하기 위함.
export function extractMarkdownImages(markdown: string): { text: string; attachments: ApImageAttachment[] } {
    const attachments: ApImageAttachment[] = []
    const text = markdown
        .replace(/!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)/g, (_match, alt: string, url: string) => {
            attachments.push({
                type: 'Image',
                mediaType: guessImageMediaType(url),
                url,
                ...(alt ? { name: alt } : {}),
            })
            return ''
        })
        .replace(/[ \t]+\n/g, '\n')
        .trim()
    return { text, attachments }
}
