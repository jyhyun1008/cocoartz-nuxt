import { db } from '../utils/db'
import {
    users, actors, follows, remoteFollows, posts, chats, likes, reactions,
    chatReactions, notifications, mutes, wordMutes, emojiMutes, currencyBalances, userItems,
    attendanceClaims,
} from '../db/schema'
import { eq, or } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { requireUserId, destroyAuthSession } from '../utils/session'
import { publishAccountDelete } from '../utils/ap/publishAccountDelete'
import { kickUserConnections } from '../routes/_ws'

const DELETED_CONTENT_NOTICE = '탈퇴한 유저가 작성한 게시물입니다.'

// 회원 탈퇴 — 되돌릴 수 없음. 유저 판단에 따른 로컬 처리 방침:
// - users 행 자체는 안 지움(그래야 이 유저 글에 달린 답글이 안 끊김) — 대신 개인정보를
//   전부 지워서 익명화하고 deletedAt을 찍어 로그인/AP 액터 조회를 영구히 막음
// - 이 유저가 쓴 게시글/댓글(posts)과 채팅(chats)도 행은 남기되 제목/본문만 지움 — 답글/대화
//   흐름 자체는 안 끊기게. 원격에 이미 배포된 글은 별도로 실제 Delete를 보냄(아래)
// - 이 유저가 남에게 한 좋아요/리액션/부스트, 팔로우 관계, 개인 설정(뮤트/재화/인벤토리/출석)은
//   전부 삭제 — 계정과 함께 완전히 사라져야 하는 "이 유저만의" 데이터라서
// - 위키(wikiPages)는 건드리지 않음 — 여러 사람이 같이 고치는 문서라 한 사람이 나갔다고
//   내용을 지우면 다른 기여자들 작업까지 같이 사라짐
export default eventHandler(async (event) => {
    const { password } = await readBody(event)
    const userid = await requireUserId(event)

    const [user] = await db.select().from(users).where(eq(users.id, userid))
    if (!user) throw createError({ statusCode: 404, message: '유저를 찾을 수 없습니다' })
    if (user.deletedAt) throw createError({ statusCode: 400, message: '이미 탈퇴한 계정입니다' })

    // 파괴적이고 되돌릴 수 없는 작업이라, 세션이 있다고 바로 처리하지 않고 비밀번호를 한 번 더 확인함
    if (!password || !user.password || !(await bcrypt.compare(password, user.password))) {
        throw createError({ statusCode: 401, message: '비밀번호가 올바르지 않습니다' })
    }

    const config = useRuntimeConfig()
    const domain = config.domain as string

    // 로컬 데이터를 지우기 전에 먼저 연합에 Delete를 보냄(지우고 나면 게시글 objectId 등 발송에
    // 필요한 정보 자체가 없어짐) — 발송 실패해도 탈퇴 자체는 그대로 진행(fire-and-forget)
    if (domain) {
        void publishAccountDelete(userid, domain).catch((e) => console.error('[deleteAccount] 연합 Delete 배포 실패', e))
    }

    await db.transaction(async (tx) => {
        // 이 유저만의 데이터 — 계정과 함께 완전히 삭제
        await tx.delete(likes).where(eq(likes.userid, userid))
        await tx.delete(reactions).where(eq(reactions.userid, userid))
        await tx.delete(chatReactions).where(eq(chatReactions.userid, userid))
        await tx.delete(notifications).where(eq(notifications.userid, userid))
        await tx.delete(mutes).where(or(eq(mutes.userid, userid), eq(mutes.targetUserId, userid)))
        await tx.delete(wordMutes).where(eq(wordMutes.userid, userid))
        await tx.delete(emojiMutes).where(eq(emojiMutes.userid, userid))
        await tx.delete(currencyBalances).where(eq(currencyBalances.userid, userid))
        await tx.delete(userItems).where(eq(userItems.userid, userid))
        await tx.delete(attendanceClaims).where(eq(attendanceClaims.userid, userid))
        await tx.delete(follows).where(or(eq(follows.userid, userid), eq(follows.followerUserId, userid)))
        await tx.delete(remoteFollows).where(eq(remoteFollows.userid, userid))
        await tx.delete(actors).where(eq(actors.userid, userid))
        // boosts는 로컬 유저 소유가 아니라 원격 부스트 캐시(actorUrl 기준)라 이 유저가 "받은"
        // 부스트를 지울 방법이 없고 지울 이유도 없음 — 건드리지 않음

        // 이 유저가 쓴 글/댓글/채팅 — 행은 남기고 내용만 지움(답글/대화 흐름 유지)
        await tx.update(posts).set({ title: DELETED_CONTENT_NOTICE, content: DELETED_CONTENT_NOTICE })
            .where(eq(posts.userid, userid))
        await tx.update(chats).set({ content: DELETED_CONTENT_NOTICE })
            .where(eq(chats.userid, userid))

        // 계정 자체는 행을 남기고 익명화 — username/email은 나중에 재가입 가능하게 비워주고,
        // 그 외 개인정보는 전부 지움. deletedAt이 로그인/AP 액터 조회를 영구히 막는 플래그
        await tx.update(users).set({
            // username은 @핸들·URL에 그대로 쓰이는 값이라 ASCII로(가입 폼 자체가 원래 "영문,
            // 숫자"만 안내하기도 함) — 화면에 보이는 표시 이름은 knownas로 따로 자연스럽게 채움
            username: `deleted-user-${userid}`,
            email: `deleted-${userid}@deleted.invalid`,
            password: null,
            knownas: '탈퇴한 유저',
            avatar: null,
            banner: null,
            bio: null,
            character: null,
            map: null,
            emailVerifiedAt: null,
            emailVerificationToken: null,
            emailVerificationTokenExpiresAt: null,
            passwordResetToken: null,
            passwordResetTokenExpiresAt: null,
            deletedAt: new Date(),
        }).where(eq(users.id, userid))
    })

    // 지금 맵에 접속해 있으면 즉시 끊어냄
    kickUserConnections(userid, 'account_deleted')

    deleteCookie(event, 'user-id')
    await destroyAuthSession(event)

    return { ok: true }
})
