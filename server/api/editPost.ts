import { db } from '../utils/db'
import { posts, rooms } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { postid, title, content } = await readBody(event)
    const userid = await requireUserId(event)
    const [post] = await db.select().from(posts).where(eq(posts.id, postid))
    if (!post) throw createError({ statusCode: 404, message: '게시글을 찾을 수 없습니다' })
    if (!post.userid || post.userid !== userid) throw createError({ statusCode: 403, message: '본인 글만 수정할 수 있습니다' })

    // 연합 게시판 글은 이미 원격에 배포된 내용이라 로컬만 조용히 고치는 게 의미 없어서 편집 자체를 막음
    if (!post.replyto) {
        const [room] = await db.select().from(rooms).where(eq(rooms.id, post.roomid))
        if (room?.federated) throw createError({ statusCode: 403, message: '연합 게시판 글은 수정할 수 없습니다' })
    } else if (post.objectId) {
        throw createError({ statusCode: 403, message: '연합 게시판 글은 수정할 수 없습니다' })
    }

    const [updated] = await db.update(posts)
        .set({ title, content })
        .where(eq(posts.id, postid))
        .returning()

    return updated
})
