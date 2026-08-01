import { db } from '../utils/db'
import { posts, users, likes, reactions, boosts } from '../db/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
    const { postid, userid } = await readBody(event)

    const [post] = await db.select().from(posts).where(eq(posts.id, postid))
    if (!post) return null

    const [user] = post.userid ? await db.select().from(users).where(eq(users.id, post.userid)) : []

    const comments = await db.select().from(posts).where(eq(posts.replyto, String(postid)))
    for (const comment of comments) {
        const [commentUser] = comment.userid ? await db.select().from(users).where(eq(users.id, comment.userid)) : []
        ;(comment as any).user = commentUser
    }

    const allLikes = await db.select().from(likes).where(eq(likes.postid, postid))
    const isLiked = userid ? allLikes.some((l) => l.userid === userid) : false

    const allReactions = await db.select().from(reactions).where(eq(reactions.postid, postid))
    const reactionMap: Record<string, { count: number; reacted: boolean }> = {}
    for (const r of allReactions) {
        if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, reacted: false }
        reactionMap[r.emoji].count++
        if (r.userid === userid) reactionMap[r.emoji].reacted = true
    }
    const postReactions = Object.entries(reactionMap).map(([emoji, data]) => ({ emoji, ...data }))

    const allBoosts = await db.select().from(boosts).where(eq(boosts.postid, postid))

    return {
        ...post,
        user,
        comments,
        likeCount: allLikes.length,
        isLiked,
        reactions: postReactions,
        boostCount: allBoosts.length,
    }
})
