import { isObjectStorageConfigured, uploadAttachment, MAX_ATTACHMENT_SIZE } from '../utils/objectStorage'
import { requireUserId } from '../utils/session'

// 게시판/위키 글 작성 중 파일을 첨부할 때 씀(WindowBoard.vue/WindowWiki.vue 툴바) — 업로드된
// URL을 마크다운으로 본문에 그대로 삽입함(이미지면 ![]()로 인라인, 그 외엔 [📎 파일명]()으로 링크).
// 로그인한 유저면 누구나 쓸 수 있음(관리자 전용 업로드들과 달리 일반 작성 기능이라)
export default eventHandler(async (event) => {
    if (!isObjectStorageConfigured()) {
        throw createError({ statusCode: 400, message: '오브젝트 스토리지가 설정되지 않았습니다' })
    }
    await requireUserId(event)

    const parts = await readMultipartFormData(event)
    const file = parts?.find((p) => p.name === 'file')
    if (!file?.data || !file.filename) {
        throw createError({ statusCode: 400, message: '파일이 없습니다' })
    }
    if (file.data.length > MAX_ATTACHMENT_SIZE) {
        throw createError({ statusCode: 400, message: '파일 크기는 20MB 이하여야 합니다' })
    }

    const url = await uploadAttachment(file.data, file.filename, file.type ?? '', 'attachments')
    return { url, filename: file.filename, size: file.data.length }
})
