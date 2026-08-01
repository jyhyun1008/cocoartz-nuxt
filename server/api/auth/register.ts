import { db } from '../../utils/db'
import { users } from '../../db/schema'
import { eq, or, count } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export default eventHandler(async (event) => {
    const { username, email, password } = await readBody(event)

    if (!username?.trim() || !email?.trim() || !password?.trim()) {
        throw createError({ statusCode: 400, message: '모든 필드를 입력해주세요' })
    }

    if (password.length < 6) {
        throw createError({ statusCode: 400, message: '비밀번호는 6자 이상이어야 합니다' })
    }

    const existing = await db.select().from(users).where(
        or(eq(users.email, email.trim()), eq(users.username, username.trim()))
    )
    if (existing.length > 0) {
        const field = existing[0].email === email.trim() ? '이메일' : '아이디'
        throw createError({ statusCode: 409, message: `이미 사용 중인 ${field}입니다` })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // 첫 번째 가입 유저에게 어드민 자동 부여
    const [{ value: userCount }] = await db.select({ value: count() }).from(users)
    const isFirstUser = Number(userCount) === 0

    const [newUser] = await db.insert(users).values({
        username: username.trim(),
        email: email.trim(),
        password: hashedPassword,
        knownas: username.trim(),
        isAdmin: isFirstUser,
    }).returning({ id: users.id, username: users.username })

    setCookie(event, 'user-id', String(newUser.id), {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
    })

    return { id: newUser.id, username: newUser.username }
})
