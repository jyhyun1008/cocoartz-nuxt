import { db } from '../utils/db'
import { wikiPages, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getEmojiMuteLookup } from '../utils/mutes'

export default eventHandler(async (event) => {
    const { id, viewerUserId } = await readBody(event)
    const [page] = await db.select().from(wikiPages).where(eq(wikiPages.id, id))
    if (!page) throw createError({ statusCode: 404, message: '페이지를 찾을 수 없습니다' })
    const [author] = await db.select().from(users).where(eq(users.id, page.authorid))
    const editor = page.editorid
        ? (await db.select().from(users).where(eq(users.id, page.editorid)))[0]
        : null
    const history = page.history ? JSON.parse(page.history) : []

    // 커스텀 이모지 뮤트 — getWikiPageBySlug.ts와 동일한 이유/방식
    const emojiMuteLookup = await getEmojiMuteLookup(viewerUserId)
    const level = emojiMuteLookup.levelOf(`${page.title ?? ''} ${page.content ?? ''}`)
    const muted = level === 'soft' ? 'soft' : undefined

    return { ...page, author, editor, history, muted }
})
