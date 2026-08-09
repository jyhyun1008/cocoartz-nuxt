import { db } from '../utils/db'
import { posts, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { publishPostIfFederated } from '../utils/ap/publishPost'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { serverid, roomid, title, content, replyto } = await readBody(event)
    const userid = await requireUserId(event)
    const [post] = await db.insert(posts).values({
        serverid,
        roomid,
        userid,
        title,
        content,
        ...(replyto != null ? { replyto: String(replyto) } : {}),
    }).returning()
    const [user] = await db.select().from(users).where(eq(users.id, userid))

    const config = useRuntimeConfig()
    await publishPostIfFederated(post, config.domain as string).catch((e) => console.error('[createPost] 연합 배포 실패', e))

    return { ...post, user }
})
