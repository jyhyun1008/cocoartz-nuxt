import { db } from '../utils/db'
import { wordMutes } from '../db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

const MAX_WORD_MUTES_PER_USER = 100
const MAX_PATTERN_LENGTH = 200

export default eventHandler(async (event) => {
    const { pattern, isRegex, level } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    if (level !== 'soft' && level !== 'hard') throw createError({ statusCode: 400, message: 'level은 soft 또는 hard여야 합니다' })

    const trimmed = typeof pattern === 'string' ? pattern.trim() : ''
    if (!trimmed) throw createError({ statusCode: 400, message: '단어 또는 정규식을 입력해주세요' })
    if (trimmed.length > MAX_PATTERN_LENGTH) throw createError({ statusCode: 400, message: `너무 깁니다(최대 ${MAX_PATTERN_LENGTH}자)` })

    if (isRegex) {
        try {
            new RegExp(trimmed, 'i')
        } catch {
            throw createError({ statusCode: 400, message: '올바른 정규식이 아닙니다' })
        }
    }

    const [{ value: existingCount }] = await db.select({ value: count() }).from(wordMutes).where(eq(wordMutes.userid, userid))
    const [alreadyHas] = await db.select({ id: wordMutes.id }).from(wordMutes)
        .where(and(eq(wordMutes.userid, userid), eq(wordMutes.pattern, trimmed)))
    if (!alreadyHas && existingCount >= MAX_WORD_MUTES_PER_USER) {
        throw createError({ statusCode: 400, message: `단어 뮤트는 최대 ${MAX_WORD_MUTES_PER_USER}개까지 등록할 수 있습니다` })
    }

    const [row] = await db.insert(wordMutes).values({
        userid, pattern: trimmed, isRegex: !!isRegex, level,
    }).onConflictDoUpdate({
        target: [wordMutes.userid, wordMutes.pattern],
        set: { isRegex: !!isRegex, level },
    }).returning()
    return row
})
