import { db } from '../utils/db'
import { posts, users, rooms, follows } from '../db/schema'
import { eq } from 'drizzle-orm'
import { publishPostIfFederated } from '../utils/ap/publishPost'
import { requireUserId } from '../utils/session'
import { broadcastNewPost, broadcastFederatedBoardPost, broadcastTimelineNewPost } from '../routes/_ws'

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

    // 댓글(replyto 있음)은 새 글이 아니라 대화의 일부라 아래 전부 제외
    if (replyto == null) {
        const [room] = await db.select({ path: rooms.path, federated: rooms.federated }).from(rooms).where(eq(rooms.id, roomid))
        if (room) {
            if (room.federated) {
                // 연합 게시판은 사이드바 동그라미 대신, 그 채널을 지금 보고 있는 사람들에게
                // 실제 글 내용을 실시간으로 흘려보냄(연합 타임라인 스트리밍) — 보는 사람마다
                // 뮤트 판정을 따로 하느라(DB 조회) 시간이 걸릴 수 있어서 응답을 안 기다리게 함
                void broadcastFederatedBoardPost(room.path, { kind: 'local', post: { ...post, user } })
                    .catch((e) => console.error('[createPost] 연합 게시판 스트리밍 실패', e))
            } else {
                // 사이드바 채널명 옆 안 읽음 표시(악센트색 동그라미) — 연합 게시판은 원격 유입까지
                // 합치면 사실상 항상 켜져 있는 셈이라 의미가 없어서 여기서만 씀. 글쓴이 본인은
                // 제외(자기가 방금 쓴 글이니 알림받을 이유가 없음 — 파비콘 배지까지 같이 영향받아서
                // 본인한테 안 보내는 쪽으로 서버에서 아예 걸러둠)
                broadcastNewPost(room.path, userid)
            }
        }

        // 개인 팔로잉 타임라인(WindowTimeline.vue) 실시간 스트리밍 — getFollowingFeed.ts가
        // "이 글쓴이를 팔로우하는 로컬 유저 + 글쓴이 본인"의 타임라인에 이 글을 보여주는 것과
        // 정확히 같은 대상에게, 방/연합 여부와 무관하게 항상 쏨(어느 채널에 썼든 팔로워 타임라인엔 다 뜨므로)
        const followerRows = await db.select({ followerUserId: follows.followerUserId }).from(follows)
            .where(eq(follows.userid, userid))
        // followerUserId는 원격(fediverse) 팔로워면 null(로컬 계정이 아니므로 실시간 대상이 될 수 없음)
        const localFollowerIds = followerRows.map((r) => r.followerUserId).filter((id): id is number => id != null)
        const timelineTargets = new Set([...localFollowerIds, userid])
        const timelineEntry = { kind: 'local' as const, post: { ...post, user, isRemote: false, sortDate: post.createdAt } }
        for (const targetId of timelineTargets) {
            void broadcastTimelineNewPost(targetId, timelineEntry)
                .catch((e) => console.error('[createPost] 개인 타임라인 스트리밍 실패', e))
        }
    }

    return { ...post, user }
})
