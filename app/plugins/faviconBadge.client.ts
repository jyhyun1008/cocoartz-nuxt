// 사이드바에 채널별 안 읽음 동그라미(useRoomSocket.ts의 unreadRooms)가 하나라도 떠 있으면,
// 다른 탭 보고 있을 때도 눈에 띄게 파비콘 오른쪽 아래에 작은 빨간 동그라미를 얹어줌 — 원본
// 파비콘 위에 캔버스로 동그라미를 그려 합성한 뒤 data URL로 바꿔서 <link rel="icon">에 꽂는
// 흔한 방식. 원본은 .ico라 브라우저마다 캔버스에 안전하게 그려진다는 보장이 약해서, PWA용으로
// 이미 있는 PNG(icon-192.png)를 베이스로 씀.
export default defineNuxtPlugin(() => {
    const ORIGINAL_HREF = '/favicon.ico'
    const BASE_ICON_HREF = '/icons/icon-192.png'

    let badgedHref: string | null = null

    function getFaviconLink(): HTMLLinkElement {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
        }
        return link
    }

    function buildBadgedFavicon(): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                const size = 64
                const canvas = document.createElement('canvas')
                canvas.width = size
                canvas.height = size
                const ctx = canvas.getContext('2d')
                if (!ctx) { reject(new Error('no 2d context')); return }
                ctx.drawImage(img, 0, 0, size, size)

                // 오른쪽 아래에 빨간 동그라미(테두리를 흰색으로 살짝 둘러서 배경 이미지랑 안 섞이게)
                const r = size * 0.24
                const cx = size - r * 0.9
                const cy = size - r * 0.9
                ctx.beginPath()
                ctx.arc(cx, cy, r, 0, Math.PI * 2)
                ctx.fillStyle = '#ffffff'
                ctx.fill()
                ctx.beginPath()
                ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2)
                ctx.fillStyle = '#ff3b30'
                ctx.fill()

                resolve(canvas.toDataURL('image/png'))
            }
            img.onerror = reject
            img.src = BASE_ICON_HREF
        })
    }

    async function setBadged(on: boolean) {
        const link = getFaviconLink()
        if (!on) {
            link.type = 'image/x-icon'
            link.href = ORIGINAL_HREF
            return
        }
        try {
            if (!badgedHref) badgedHref = await buildBadgedFavicon()
            link.type = 'image/png'
            link.href = badgedHref
        } catch {
            // 캔버스 합성이 어떤 이유로든 실패해도(예: 이미지 로드 실패) 원본 파비콘은 그대로 둠 —
            // 배지 하나 때문에 파비콘 자체가 깨지면 안 되니
        }
    }

    const { unreadRooms } = useRoomSocket()
    watch(
        () => Object.keys(unreadRooms.value).length > 0,
        (hasUnread) => setBadged(hasUnread),
        { immediate: true },
    )
})
