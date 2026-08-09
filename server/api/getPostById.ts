import { db } from '../utils/db'
import { posts, users, likes, reactions, boosts, rooms } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getMuteLookup, applyMuteFilter, getWordMuteLookup, applyWordMuteFilter, getEmojiMuteLookup, filterMutedReactions } from '../utils/mutes'

export default eventHandler(async (event) => {
    const { postid, userid } = await readBody(event)

    const [post] = await db.select().from(posts).where(eq(posts.id, postid))
    if (!post) return null

    const [user] = post.userid
        ? await db.select({ username: users.username, knownas: users.knownas, avatar: users.avatar }).from(users).where(eq(users.id, post.userid))
        : []
    const [room] = await db.select({ path: rooms.path, knownas: rooms.knownas }).from(rooms).where(eq(rooms.id, post.roomid))

    let comments = await db.select().from(posts).where(eq(posts.replyto, String(postid)))
    const commentUserIds = [...new Set(comments.map(c => c.userid).filter((id): id is number => id != null))]
    const commentUserRows = commentUserIds.length
        ? await db.select({ id: users.id, username: users.username, knownas: users.knownas, avatar: users.avatar }).from(users).where(inArray(users.id, commentUserIds))
        : []
    const commentUserById = new Map(commentUserRows.map(u => [u.id, u]))
    for (const comment of comments) {
        ;(comment as any).user = comment.userid != null ? commentUserById.get(comment.userid) : undefined
    }

    const muteLookup = await getMuteLookup(userid)
    comments = applyMuteFilter(comments, muteLookup, (c) => ({ userid: c.userid, actorUrl: c.remoteActorUrl }))
    const wordMuteLookup = await getWordMuteLookup(userid)
    comments = applyWordMuteFilter(comments, wordMuteLookup, (c) => c.content)
    const emojiMuteLookup = await getEmojiMuteLookup(userid)
    comments = applyWordMuteFilter(comments, emojiMuteLookup, (c) => c.content)

    const allLikes = await db.select().from(likes).where(eq(likes.postid, postid))
    const isLiked = userid ? allLikes.some((l) => l.userid === userid) : false

    const allReactions = await db.select().from(reactions).where(eq(reactions.postid, postid))
    const reactionMap: Record<string, { count: number; reacted: boolean }> = {}
    for (const r of allReactions) {
        if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, reacted: false }
        reactionMap[r.emoji].count++
        if (r.userid === userid) reactionMap[r.emoji].reacted = true
    }
    const postReactions = filterMutedReactions(
        Object.entries(reactionMap).map(([emoji, data]) => ({ emoji, ...data })),
        emojiMuteLookup.shortcodes,
    )

    const allBoosts = await db.select().from(boosts).where(eq(boosts.postid, postid))

    return {
        ...post,
        user,
        room,
        comments,
        likeCount: allLikes.length,
        isLiked,
        reactions: postReactions,
        boostCount: allBoosts.length,
    }
})
