import { resolveLinkPreview } from '../utils/linkPreview'

// 인증 불필요 — 비로그인 상태로 연합 게시판을 조회할 때도 링크 미리보기가 떠야 함
export default eventHandler(async (event) => {
    const { url } = await readBody(event)
    if (!url || typeof url !== 'string') return null
    return await resolveLinkPreview(url)
})
