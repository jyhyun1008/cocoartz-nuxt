import { db } from '../utils/db'
import { emojiMutes } from '../db/schema'

export default eventHandler(async (event) => {
    const { userid, shortcode } = await readBody(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })

    const trimmed = typeof shortcode === 'string' ? shortcode.trim().replace(/^:|:$/g, '') : ''
    if (!trimmed) throw createError({ statusCode: 400, message: '이모지를 선택해주세요' })

    const [row] = await db.insert(emojiMutes)
        .values({ userid, shortcode: trimmed })
        .onConflictDoNothing({ target: [emojiMutes.userid, emojiMutes.shortcode] })
        .returning()
    return row ?? { ok: true }
})
