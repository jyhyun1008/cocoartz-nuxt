import { db } from '../utils/db'
import { customEmojis } from '../db/schema'

// 우리 서버의 커스텀 이모지 전체 목록 — 인증 불필요(로그인 안 한 사람이 연합 게시판을
// 볼 때도 렌더링에 필요), createdBy 같은 민감할 것 없는 필드만 골라 반환. id는 관리자 설정
// 화면에서 삭제 버튼에 쓰라고 그대로 포함(민감 정보 아님)
export default eventHandler(async () => {
    const rows = await db.select({
        id: customEmojis.id,
        shortcode: customEmojis.shortcode,
        imageUrl: customEmojis.imageUrl,
        category: customEmojis.category,
        tags: customEmojis.tags,
    }).from(customEmojis)
    return rows
})
