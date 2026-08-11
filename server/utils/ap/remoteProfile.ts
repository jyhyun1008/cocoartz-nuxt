import { db } from '../db'
import { remoteFollows, mutes, remoteTimelinePosts } from '../../db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { resolveWebfinger, fetchActor, buildActorDisplayInfo } from './activitypub'
import { sanitizeHtml, renderCustomEmoji } from './sanitize'

// 목록 미리보기용 — content/summary는 이미 sanitizeHtml을 거쳐 <p>/<br> 같은 블록 태그를
// 포함할 수 있는데, 프로필의 글 목록은 한 줄 말줄임(ellipsis)으로 보여주는 자리라 태그가 섞이면
// (white-space:nowrap이 블록 태그의 줄바꿈까지는 못 막아서) 여러 줄로 깨짐 — 순수 텍스트만 남김
function stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// @[username].vue는 로컬 유저명뿐 아니라 "user@host" 형태의 핸들도 같은 라우트(/@user@host)로
// 받는데, 그 경우 이 함수가 getUserProfile.ts에서 위임받아 처리함 — 로컬 유저(users 테이블)와
// 최대한 같은 응답 모양을 맞춰서 프론트 쪽 분기를 최소화하되, map/character(개인 방)처럼 이
// 서버에 아예 존재하지 않는 개념은 필드 자체를 안 내려줌(프론트가 isRemote로 방 섹션을 숨김).
export async function getRemoteUserProfile(rawHandle: string, viewerUserId?: number) {
    const cleanHandle = rawHandle.trim().replace(/^@/, '')
    if (!cleanHandle.includes('@')) return null

    const actorUrl_ = await resolveWebfinger(cleanHandle)
    if (!actorUrl_) return null

    const actorData = await fetchActor(actorUrl_)
    if (!actorData) return null

    const info = buildActorDisplayInfo(actorData, actorUrl_)
    // buildActorDisplayInfo().name은 escapeHtml + 커스텀 이모지 <img> 치환까지 끝낸 HTML
    // 문자열(그 서버의 :shortcode: 이모지가 이름에 있으면 이미지로 렌더링됨) — 로컬 knownas(순수
    // 텍스트, {{ }}로 렌더링)와 형태가 달라서 프론트에서 isRemote일 때만 v-html로 꽂아넣음
    const knownas = info.name
    const bio = actorData.summary ? renderCustomEmoji(sanitizeHtml(actorData.summary as string), actorData.tag) : ''
    const bannerUrl = (actorData.image as Record<string, string> | undefined)?.url || ''
    const externalUrl = (typeof actorData.url === 'string' && actorData.url) || actorUrl_

    let isFollowing = false
    let isFollowRequested = false
    let followId: number | null = null
    let myMuteLevel: string | null = null
    if (viewerUserId) {
        const [row] = await db.select().from(remoteFollows)
            .where(and(eq(remoteFollows.userid, viewerUserId), eq(remoteFollows.targetActorUrl, actorUrl_)))
        if (row) {
            followId = row.id
            isFollowing = row.accepted
            isFollowRequested = !row.accepted
        }

        const [muteRow] = await db.select({ level: mutes.level }).from(mutes)
            .where(and(eq(mutes.userid, viewerUserId), eq(mutes.targetActorUrl, actorUrl_)))
        myMuteLevel = muteRow?.level ?? null
    }

    // 부스트(Announce)가 아니라 이 액터가 직접 쓴 글만 — 서버 전체가 공유하는 연합 타임라인
    // 캐시(remoteTimelinePosts)에서 우리가 우연히 본 것만 모은 것이라 "전체 글"은 아니고
    // "우리 연합 타임라인에 떴던 글" 정도의 best-effort 목록임
    const recentPostRows = await db.select({
        id: remoteTimelinePosts.id,
        objectId: remoteTimelinePosts.objectId,
        content: remoteTimelinePosts.content,
        summary: remoteTimelinePosts.summary,
        summaryIsTitle: remoteTimelinePosts.summaryIsTitle,
        published: remoteTimelinePosts.published,
    }).from(remoteTimelinePosts)
        .where(and(eq(remoteTimelinePosts.sourceActorUrl, actorUrl_), isNull(remoteTimelinePosts.boostedByActorUrl)))
        .orderBy(desc(remoteTimelinePosts.published))
        .limit(20)

    const recentPosts = recentPostRows.map((p) => ({
        id: p.id,
        objectId: p.objectId,
        title: p.summaryIsTitle && p.summary ? stripTags(p.summary) : null,
        // summaryIsTitle이 아닌 summary는 진짜 CW(열람주의) — 게시판/타임라인 목록 카드와 같은
        // 규칙으로 title과 분리해서 내려주고, 프론트에서 본문 대신 경고 아이콘+문구를 보여줌
        cw: !p.summaryIsTitle && p.summary ? stripTags(p.summary) : null,
        content: stripTags(p.content),
        published: p.published,
    }))

    return {
        isRemote: true,
        actorUrl: actorUrl_,
        externalUrl,
        username: cleanHandle.split('@')[0],
        handle: info.handle || `@${cleanHandle}`,
        knownas,
        avatar: info.iconUrl,
        banner: bannerUrl,
        bio,
        createdAt: null,
        posts: recentPosts,
        followerCount: null,
        followingCount: null,
        isFollowing,
        isFollowRequested,
        followId,
        myMuteLevel,
    }
}
