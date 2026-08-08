import { db } from '../utils/db'
import { wikiPages, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { getEmojiMuteLookup } from '../utils/mutes'

export default eventHandler(async (event) => {
    const { slug, roomid, viewerUserId } = await readBody(event)
    const [page] = await db.select().from(wikiPages).where(
        and(eq(wikiPages.slug, slug), eq(wikiPages.roomid, roomid))
    )
    if (!page) throw createError({ statusCode: 404, message: '페이지를 찾을 수 없습니다' })
    const [author] = await db.select().from(users).where(eq(users.id, page.authorid))
    const editor = page.editorid
        ? (await db.select().from(users).where(eq(users.id, page.editorid)))[0]
        : null
    const history = page.history ? JSON.parse(page.history) : []

    // 커스텀 이모지 뮤트 — 위키는 계정/단어 뮤트 개념이 아직 없지만(여러 사람이 같이 고쳐나가는
    // 문서라 "작성자" 하나로 걸 이유가 없음), 특정 이모지가 쓰였는지는 내용 기준으로 판단 가능하니
    // 그 부분만 소프트 뮤트로 가려줌
    const emojiMuteLookup = await getEmojiMuteLookup(viewerUserId)
    const level = emojiMuteLookup.levelOf(`${page.title ?? ''} ${page.content ?? ''}`)
    const muted = level === 'soft' ? 'soft' : undefined

    return { ...page, author, editor, history, muted }
})
