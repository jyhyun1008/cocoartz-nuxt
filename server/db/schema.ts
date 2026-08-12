import { pgTable, integer, timestamp, text, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    username: text().notNull().unique(),
    knownas: text(),
    email: text().notNull().unique(),
    password: text(),
    avatar: text(),
    banner: text(),
    bio: text(),
    character: text(),
    map: text(),
    isAdmin: boolean().default(false).notNull(),
    // 승인제 가입일 때 관리자 승인 전까지 false. 기존 유저/자유 가입 유저는 true.
    approved: boolean().default(true).notNull(),
    // true면 이 유저를 팔로우하려는 요청(로컬/원격 모두)이 바로 승인되지 않고 대기 상태(follows.accepted=false)로
    // 쌓여서, 본인이 직접 승인/거절해야 함. 기본값 false(지금까지처럼 전부 자동 승인)
    requireFollowApproval: boolean().default(false).notNull(),
    // null이 아니면 영구정지(그 시각에 정지됨). 관리자 정지/영구정지 기능(server/utils/userStatus.ts)에서 씀
    bannedAt: timestamp({ withTimezone: true }),
    banReason: text(),
    // null이 아니고 미래 시각이면 그때까지 일시정지 중. 지나면 별도 해제 없이 자동으로 풀림
    suspendedUntil: timestamp({ withTimezone: true }),
    suspendReason: text(),
    // 이메일 인증(server/utils/emailVerification.ts) — null이면 미인증. SMTP가 꺼져있는 서버에선
    // 인증 메일을 보낼 방법이 없으니 이 값과 무관하게 항상 "인증됨"으로 취급함. SMTP가 켜져있는
    // 서버에선 login.ts가 이 값을 실제 로그인 게이트로 씀(단, isAdmin 계정과 — 이 컬럼에 마이그레이션
    // 시점 기존 유저를 소급 인증 처리해둬서 — 이 기능 이전 가입자는 게이트 대상에서 빠짐. 이
    // 기능 이후의 신규 가입자만 실제로 인증을 안 하면 로그인이 막힘)
    emailVerifiedAt: timestamp({ withTimezone: true }),
    emailVerificationToken: text(),
    emailVerificationTokenExpiresAt: timestamp({ withTimezone: true }),
    // 재전송 버튼 스팸/남용 방지용 쿨다운 판정에만 씀
    emailVerificationSentAt: timestamp({ withTimezone: true }),
    // 비밀번호 재설정(server/utils/passwordReset.ts) — 이메일 인증과 별개 토큰 체계로 둠(용도가
    // 달라서 하나가 다른 하나의 유효성에 영향을 주면 안 됨)
    passwordResetToken: text(),
    passwordResetTokenExpiresAt: timestamp({ withTimezone: true }),
    passwordResetSentAt: timestamp({ withTimezone: true }),
    // 회원 탈퇴(server/api/deleteAccount.ts) — null이 아니면 탈퇴한 계정. 행 자체는 안 지움(그
    // 유저가 쓴 글/댓글의 답글이 안 끊기게, FK 대신 관행으로 참조하는 다른 테이블들이 안 깨지게)
    // — 대신 username/email/password/avatar/character 등 개인정보를 여기서 지워서 익명화하고,
    // 로그인은 이 값이 있으면 항상 막음(userStatus.ts). AP 액터 GET(users/[username]/index.get.ts)도
    // 이 값을 보고 410 Gone을 돌려줌(마스토돈과 동일 — 탈퇴 계정 키 재조회 요청에 대한 표준 응답)
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lastLogin: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const members = pgTable('members', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    serverid: integer().notNull(),
    knownas: text(),
    role: text(),
    userid: integer().notNull(),
    avatar: text(),
    bio: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const servers = pgTable('servers', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    themecolor: text(),
    avatar: text(),
    info: text(),
    rooms: text(),
    map: text(),
    // 'open'(자유 가입) | 'approval'(승인제) | 'closed'(가입 차단)
    registrationMode: text().default('open').notNull(),
    // 맵 아이템 코인 수집 등에서 쓰는 재화 이름(서버별로 다르게 부를 수 있게) — 기본 "코코아"
    currencyName: text().default('코코아'),
    // 가입 완료 시 자동으로 지급하는 재화(server/api/auth/register.ts) — 0이면 지급 안 함
    signupBonus: integer().default(100).notNull(),
    // 새로 가입한(혹은 아직 자기 방을 한 번도 안 꾸며서 users.map이 null인) 유저의 개인 방
    // 기본 모습. null이면 UserRoomEmbed.vue/WindowMapEditor.vue에 하드코딩된 6x6 기본 맵을
    // 대신 씀. 관리자 설정(WindowSettings.vue "서버 정보")에서 맵 편집기로 직접 꾸밀 수 있음 —
    // saveDefaultUserMap.ts로 저장. 유저가 자기 방을 한 번이라도 저장하면 그 뒤로는 이 템플릿과
    // 무관하게 본인 맵(users.map)을 씀.
    defaultUserMap: text(),
    // 서버 자체를 대표하는 시스템 AP 액터(유저 개인 액터와 별개) — 마스토돈의 "Authorized fetch"
    // (시큐어 모드) 등 일부 원격 서버는 액터 프로필 조회 같은 단순 GET 요청까지도 서명을 요구해서,
    // 서명 없이 보내던 fetchActor/fetchObject(server/utils/ap/activitypub.ts)가 거절당하는 문제가
    // 있었음. 특정 유저 행동과 무관한(서명 검증 중 상대 공개키를 가져오는 등) 서버 대 서버 호출이라
    // 유저 개인 액터를 빌려 쓰기 애매해서 서버 전용으로 따로 둠. null이면 처음 필요할 때
    // ensureInstanceActor()가 자동 생성함(server/utils/ap/instanceActor.ts)
    instanceActorPublicKey: text(),
    instanceActorPrivateKey: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const rooms = pgTable('rooms', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    path: text().notNull().unique(),
    knownas: text().notNull(),
    type: text().notNull(),
    info: text(),
    map: text(),
    readrole: text(),
    writerole: text(),
    adminrole: text(),
    federated: boolean().default(false).notNull(),
    // 게시판(type='board') 목록을 카드 리스트 대신 2단 그리드 갤러리로 보여줄지 — 관리자만 채널
    // 관리 화면에서 켤 수 있고(유저가 직접 바꾸는 옵션 아님), 연합 게시판은 카드에 원격 글까지
    // 섞여서 정사각형 썸네일 레이아웃이 안 어울려서 못 켜게 막음(setFederatedRoom.ts 참고)
    galleryView: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const chats = pgTable('chats', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    serverid: integer().notNull(),
    roomid: integer().notNull(),
    userid: integer().notNull(),
    content: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    history: text(),
    replyto: text(),
    // 채팅 메시지 수정 시 true — "(수정됨)" 표시용. 삭제는 이력 안 남기고 그냥 row 자체를 지움
    edited: boolean().default(false).notNull(),
}, (table) => [
    // getChatsByRoomId.ts가 방 들어갈 때마다 (serverid, roomid)로 전체를 긁는데, 인덱스가 하나도
    // 없어서 채팅이 쌓일수록 매번 풀스캔이었음
    index('chats_room_idx').on(table.serverid, table.roomid),
])

export const posts = pgTable('posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // 개인 타임라인에서 원격 팔로우 피드 글에 단 답글(remoteParentObjectId 참고)은 특정 방에 속하지
    // 않아서 nullable — 그 외 일반 게시판 글은 항상 값이 채워짐
    serverid: integer(),
    roomid: integer(),
    userid: integer(),
    title: text().notNull(),
    content: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    history: text(),
    replyto: text(),
    // ActivityPub
    objectId: text(),
    remoteActorUrl: text(),
    remoteActorName: text(),
    remoteActorHandle: text(),
    remoteActorIconUrl: text(),
    remoteActorInbox: text(),
    // 이 글이 다른 원격 글을 인용(quote)한 경우 그 원본 글의 AP 오브젝트 URL, 아니면 본문에
    // 있는 첫 번째 일반 링크(둘 다 없으면 null) — server/utils/ap/linkExtract.ts에서 추출
    quoteUrl: text(),
    linkUrl: text(),
    // 이 글이 로컬 게시판 글타래가 아니라, 팔로우 피드에 뜬 원격(remoteFeedPosts) 글에 대한
    // 내 답글일 때 그 원격 글의 objectId. 이 값이 있으면 게시판 목록/개인 타임라인에서는
    // 숨기고(replyto 기반 글타래가 아니므로 isNull(replyto) 필터로는 안 걸러짐), 원격 글
    // 상세보기 쪽 댓글창에서만 보여줌
    remoteParentObjectId: text(),
    // 원격 댓글/답글의 CW(content warning) — remoteFeedPosts/remoteTimelinePosts와 같은 개념.
    // 로컬 글/댓글은 CW 작성 UI가 없어서 항상 null
    summary: text(),
}, (table) => [
    uniqueIndex('posts_object_id_idx').on(table.objectId),
    // 게시판 목록(roomid), 개인 타임라인/프로필(userid), 댓글 조회(replyto) — 전부 인덱스 없이
    // 풀스캔하고 있었음(N+1 쿼리 수정과 별개로, 이건 테이블 자체가 커질수록 심각해지는 문제)
    index('posts_room_idx').on(table.roomid),
    index('posts_userid_idx').on(table.userid),
    index('posts_replyto_idx').on(table.replyto),
])

export const likes = pgTable('likes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer(),
    postid: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    // ActivityPub (remote likes)
    remoteActorUrl: text(),
    remoteActorName: text(),
    remoteActorHandle: text(),
    remoteActorIconUrl: text(),
    activityId: text(),
}, (table) => [
    uniqueIndex('likes_activity_id_idx').on(table.activityId),
    index('likes_postid_idx').on(table.postid),
])

export const actors = pgTable('actors', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    publicKey: text().notNull(),
    privateKey: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('actors_userid_idx').on(table.userid),
])

export const follows = pgTable('follows', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    followerActorUrl: text().notNull(),
    followerInbox: text().notNull(),
    // 팔로우하는 쪽이 로컬 유저일 때만 채움(같은 서버 유저끼리의 팔로우 표시/조회용).
    // 원격(fediverse) 팔로워는 계속 null — followerActorUrl/followerInbox만으로 식별.
    followerUserId: integer(),
    accepted: boolean().default(true).notNull(),
    followActivityId: text(),
    // 원격 팔로워 표시용 캐시(팔로워 목록 UI에서 재조회 없이 쓰기 위함). 로컬 팔로워는 null로 두고 users 테이블에서 조회
    remoteActorName: text(),
    remoteActorHandle: text(),
    remoteActorIconUrl: text(),
    // 위 캐시를 마지막으로 갱신(fetchActor)한 시각 — 오래됐으면 조회 시점에 다시 가져와서
    // 닉네임/프사가 바뀐 걸 반영함(원격 계정이 Update 액티비티를 안 보내는 경우 대비)
    remoteActorCachedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('follows_userid_actor_idx').on(table.userid, table.followerActorUrl),
    // userid는 위 복합 유니크 인덱스의 왼쪽 컬럼이라 이미 커버되지만, followerUserId(로컬 팔로워
    // 조회 — getFollowingFeed.ts 등)는 별도 컬럼이라 인덱스가 전혀 없었음
    index('follows_follower_userid_idx').on(table.followerUserId),
])

// 개인 알림함 — 우선 'follow' 타입만 사용하지만 향후 확장 대비 문자열 type으로 둠
export const notifications = pgTable('notifications', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    type: text().notNull(),
    actorUserId: integer(),
    read: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('notifications_userid_idx').on(table.userid),
])

export const boosts = pgTable('boosts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    postid: integer().notNull(),
    actorUrl: text().notNull(),
    actorName: text(),
    actorHandle: text(),
    actorIconUrl: text(),
    activityId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('boosts_activity_id_idx').on(table.activityId),
    index('boosts_postid_idx').on(table.postid),
])

export const reactions = pgTable('reactions', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    postid: integer().notNull(),
    emoji: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('reactions_postid_idx').on(table.postid),
])

export const chatReactions = pgTable('chat_reactions', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    chatid: integer().notNull(),
    emoji: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('chat_reactions_chatid_idx').on(table.chatid),
])

// 우리 서버 자체의 커스텀 이모지(관리자 업로드) — 게시판/채팅/위키 본문과 리액션에서
// :shortcode: 로 쓸 수 있고, 연합 게시판에 올라간 글은 이 정보를 AP tag 배열에 실어서
// 다른 서버에서도 이미지로 보이게 함(server/utils/ap/publishPost.ts)
export const customEmojis = pgTable('custom_emojis', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    shortcode: text().notNull().unique(), // 콜론 없이 저장(예: "party_blob"), 매칭/렌더링 시에만 앞뒤로 콜론을 붙임
    imageUrl: text().notNull(),
    imageType: text().notNull(), // 업로드 시 MIME 타입 — 연합 태그의 icon.mediaType에 그대로 사용
    // 이모지 수가 늘어나면서 피커에서 유니코드 이모지처럼 분류/검색이 필요해져 추가 — 둘 다
    // 선택 입력(관리자가 안 채워도 업로드/사용엔 지장 없음, 그냥 "미분류"로만 묶임)
    category: text(), // 피커 카테고리 칩 하나(자유 텍스트 — 기존에 쓰인 값이 admin UI 자동완성으로 나옴)
    tags: text(), // 검색용 한국어 키워드, 공백으로 구분(예: "축하 파티 짝짝짝")
    createdBy: integer(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const wikiPages = pgTable('wiki_pages', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    serverid: integer().notNull(),
    roomid: integer().notNull(),
    title: text().notNull(),
    slug: text().notNull(),
    content: text().notNull(),
    authorid: integer().notNull(),
    editorid: integer(),
    history: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('wiki_pages_roomid_idx').on(table.roomid),
])

// 유저 개인이 팔로우하는 원격(fediverse) 계정
export const remoteFollows = pgTable('remote_follows', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    targetActorUrl: text().notNull(),
    targetInbox: text().notNull(),
    targetHandle: text(),
    targetName: text(),
    targetIconUrl: text(),
    // follows.remoteActorCachedAt와 같은 목적 — 마지막으로 이 캐시를 갱신한 시각
    remoteActorCachedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    accepted: boolean().default(false).notNull(),
    followActivityId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('remote_follows_userid_target_idx').on(table.userid, table.targetActorUrl),
])

// 유저 개인이 뮤트한 상대 — 로컬 유저(targetUserId)든 원격 액터(targetActorUrl, 팔로우 여부 무관)든
// 가능. soft: 목록엔 뜨되 "뮤트된 게시물입니다" 게이트로 가려짐. hard: 조회 결과에서 아예 제외.
// 뮤트를 건 사람 화면에만 영향 — 차단과 달리 상대의 활동/다른 사람이 보는 화면엔 영향 없음
export const mutes = pgTable('mutes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    targetUserId: integer(),
    targetActorUrl: text(),
    targetActorName: text(),
    targetActorHandle: text(),
    targetActorIconUrl: text(),
    level: text().notNull(), // 'soft' | 'hard'
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('mutes_userid_target_user_idx').on(table.userid, table.targetUserId),
    uniqueIndex('mutes_userid_target_actor_idx').on(table.userid, table.targetActorUrl),
])

// 계정 단위 뮤트(위 mutes)와 별개로, 특정 단어/정규식이 제목+본문에 매치되면 작성자가 누구든
// 걸리는 개인별 콘텐츠 뮤트. 동작 방식(soft/hard)은 mutes와 동일하게 재사용
export const wordMutes = pgTable('word_mutes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    pattern: text().notNull(),
    isRegex: boolean().default(false).notNull(),
    level: text().notNull(), // 'soft' | 'hard'
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('word_mutes_userid_pattern_idx').on(table.userid, table.pattern),
])

// 특정 커스텀 이모지(:shortcode:) 자체를 개인적으로 뮤트 — 위 word_mutes와 달리 레벨을 유저가
// 고르게 하지 않고 맥락별로 동작을 고정함: 글/댓글/위키/채팅 "본문"에 그 이모지가 쓰였으면
// 소프트(게이트), 리액션으로 달려있으면 그냥 목록에서 통째로 제외(가릴 필요 없이 아예 안 보임)
export const emojiMutes = pgTable('emoji_mutes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    shortcode: text().notNull(), // 콜론 없이 저장 — 매칭 시 `:${shortcode}:` 형태로 비교
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('emoji_mutes_userid_shortcode_idx').on(table.userid, table.shortcode),
])

// 유저 개인 팔로잉 피드에 들어오는 원격 글
export const remoteFeedPosts = pgTable('remote_feed_posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    sourceActorUrl: text().notNull(),
    sourceHandle: text(),
    sourceName: text(),
    sourceIconUrl: text(),
    // 이 글이 팔로우 계정의 직접 작성글이 아니라 부스트(Announce)로 들어온 경우, 누가 부스트했는지
    // (원본 작성자 정보는 위 source* 필드에 그대로 유지됨). 직접 작성글이면 전부 null
    boostedByActorUrl: text(),
    boostedByName: text(),
    boostedByHandle: text(),
    boostedByIconUrl: text(),
    objectId: text().notNull(),
    content: text().notNull(),
    // 다른 원격 글을 인용(quote)한 경우 그 원본 글의 AP 오브젝트 URL, 아니면 본문 속 첫 링크
    quoteUrl: text(),
    linkUrl: text(),
    // 원격 글의 CW(content warning)/서두 텍스트. 없으면 null → 목록에서 본문 미리보기로 대체 표시
    summary: text(),
    // true면 summary가 진짜 CW가 아니라 "게시글 제목"임 — 코코아츠는 서로 연합해도 CW 기능이 없어서
    // 자기 게시판 글 제목을 그대로 summary(AP의 CW 자리)에 실어보내는데(publishPost.ts), 받는 쪽도
    // 코코아츠 서버면 그걸 진짜 CW로 취급해 내용을 가려버리면 연합 타임라인이 온통 "열람주의"
    // 게이트로 뒤덮여 보임. 발신 액터의 서버가 nodeinfo상 코코아츠로 확인될 때만 true로 저장해서,
    // 프론트에서 CW 게이트 대신 평범한 제목처럼(안 가리고) 보여줌
    summaryIsTitle: boolean().default(false).notNull(),
    // to/cc에 AS_PUBLIC이 있었는지 (전체공개/조용히 공개 여부). 개인 타임라인(getFollowingFeed)은
    // 팔로우 관계로 받은 글이라 공개범위 무관하게 다 보여주지만, 연합 게시판(getRemoteFeedPosts)은
    // 모두가 보는 공개 게시판이라 이 값이 true인 글만 노출해야 함
    isPublic: boolean().default(true).notNull(),
    // 내가(로컬 유저가) 이 원격 글에 좋아요를 보냈는지, 그리고 취소(Undo) 때 참조할 Like 액티비티 id
    liked: boolean().default(false).notNull(),
    likeActivityId: text(),
    published: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('remote_feed_posts_userid_object_idx').on(table.userid, table.objectId),
])

// 서버(인스턴스) 전체가 공유하는 연합 타임라인 — 로컬 유저 중 누군가가 팔로우해서 인박스로 받은
// 공개 원격 글을 유저 구분 없이 objectId 기준 한 번만 저장. 로그인 여부와 무관하게 연합 게시판에 노출됨
export const remoteTimelinePosts = pgTable('remote_timeline_posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sourceActorUrl: text().notNull(),
    // 좋아요/답글을 원 작성자에게 보낼 때 필요 — 뷰어가 그 계정을 개인적으로 팔로우 안 해도 되도록 여기 캐시
    sourceInbox: text().notNull(),
    sourceHandle: text(),
    sourceName: text(),
    sourceIconUrl: text(),
    // 부스트(Announce)로 들어온 글이면 누가 부스트했는지 (원본 작성자는 위 source* 필드 그대로)
    boostedByActorUrl: text(),
    boostedByName: text(),
    boostedByHandle: text(),
    boostedByIconUrl: text(),
    objectId: text().notNull(),
    content: text().notNull(),
    quoteUrl: text(),
    linkUrl: text(),
    summary: text(),
    // remoteFeedPosts.summaryIsTitle과 동일한 이유 — 코코아츠 서버끼리 연합할 때 CW를 게시글
    // 제목으로 취급하기 위한 플래그
    summaryIsTitle: boolean().default(false).notNull(),
    published: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('remote_timeline_posts_object_id_idx').on(table.objectId),
])

// 로컬 유저가 연합 타임라인 글에 좋아요 — 뷰어별 상태라 공용 글 테이블과 분리해서 관리
export const remoteTimelinePostLikes = pgTable('remote_timeline_post_likes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    remoteTimelinePostId: integer().notNull(),
    userid: integer().notNull(),
    likeActivityId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('remote_timeline_post_likes_post_user_idx').on(table.remoteTimelinePostId, table.userid),
])

// 원격 글에 포함된 일반 링크(유튜브/사운드클라우드 포함)의 미리보기 캐시 — URL 기준으로 한 번만
// 가져오면 같은 링크를 공유하는 다른 글에서도 재사용됨(server/utils/linkPreview.ts)
export const linkPreviews = pgTable('link_previews', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    url: text().notNull().unique(),
    kind: text().default('generic').notNull(), // 'generic' | 'youtube' | 'soundcloud'
    title: text(),
    description: text(),
    imageUrl: text(),
    siteName: text(),
    // youtube: watch URL의 video id로 만든 embed URL / soundcloud: oEmbed로 받은 iframe의 src
    embedUrl: text(),
    fetchedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

// 서버가 보내는 이메일(가입 신청/승인 알림 등)용 SMTP 설정 — 단일 테넌트라 서버당 1행만 씀.
// ⚠️ servers 테이블과 달리 이 테이블은 절대 공개(인증 없는) 엔드포인트에서 select하면 안 됨
// (getServerBySlug.ts처럼 전체 컬럼을 그대로 내려주는 곳에 smtpPassword가 노출되면 큰일 남) —
// server/api/admin/*.ts 관리자 전용 엔드포인트와 server/utils/mailer.ts에서만 조회할 것
export const emailSettings = pgTable('email_settings', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    smtpHost: text(),
    smtpPort: integer().default(587),
    smtpSecure: boolean().default(false).notNull(), // true=암시적 TLS(보통 465), false=STARTTLS(보통 587)
    smtpUser: text(),
    smtpPassword: text(), // 평문 저장 — 위 경고 참고
    fromAddress: text(),
    fromName: text(),
    enabled: boolean().default(false).notNull(), // 꺼져있거나 필수값이 비어있으면 발송 자체를 스킵
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

// 서버(커뮤니티)별 재화 잔액 — 맵 아이템 코인 수집(server/api/collectCoin.ts)으로 쌓임.
// userid+serverid 조합 하나당 행 하나(같은 서버 안에서만 통용, 다른 서버 배포끼리는 안 섞임).
export const currencyBalances = pgTable('currency_balances', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    serverid: integer().notNull(),
    balance: integer().default(0).notNull(),
    // 코인 수집 연타/스크립트 방지용 최소 쿨다운 판정에 씀(server/api/collectCoin.ts)
    lastCollectedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('currency_balances_userid_serverid_idx').on(table.userid, table.serverid),
])

// 상점에 올라갈 수 있는 아이템 마스터 카탈로그. 서버(커뮤니티)에 묶이지 않고 배포 전체에서 공유되는
// 하나의 목록임 — 캐릭터 파츠(useCharacter.ts)/맵 아이템(useItemCatalog.ts)처럼 코드에 정의된
// 에셋을 그대로 참조하는 거라, 어차피 하나의 배포는 하나의 코드베이스만 쓰기 때문. 재화 잔액만
// currencyBalances처럼 serverid로 나뉨(구매 시 어느 커뮤니티 지갑에서 깎을지는 buyItem.ts에서 결정).
export const items = pgTable('items', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // 'avatar_hair' | 'avatar_top' | 'avatar_bottom' | 'avatar_shoes' | 'avatar_face' | 'avatar_body'
    // | 'terrain' | 'map_item' | 'functional' | 'consumable' | 'map_background'
    category: text().notNull(),
    // 카테고리별로 다른 값을 가리킴 — avatar_*: useCharacter.ts CHARACTER_PARTS의 variant 번호,
    // terrain: 타일셋 이미지 인덱스, map_item: useItemCatalog.ts ITEM_CATALOG의 id, map_background:
    // useMapBackgroundCatalog.ts가 참조하는 자유 문자열 키. functional/consumable은 아직 렌더링
    // 코드가 없어서(농사 시스템에서 나중에 정의) 자유 형식 문자열로 둠
    itemKey: text().notNull(),
    name: text().notNull(),
    description: text(),
    // 상점 목록/인벤토리 썸네일 — 보통 캐릭터 파츠/타일/맵아이템 이미지 경로를 그대로 재사용
    icon: text(),
    price: integer().notNull(),
    // functional/consumable 아이템이 실제로 하는 일(예: 농사 씨앗의 작물 종류·성장 시간) — JSON 문자열.
    // 아직 아무 기능도 안 붙어서 전부 null이어도 됨
    meta: text(),
    // 상점 목록에서 숨기고 싶을 때(단종/시즌 한정) false로 — 이미 산 사람의 인벤토리·장착 상태는 안 건드림
    active: boolean().default(true).notNull(),
    // true면 가입 시점에 인벤토리로 자동 지급(server/api/auth/register.ts) — 카테고리 전체가 아니라
    // 아이템 단위로 관리자가 직접 고름(예: 헤어 스타일을 새로 추가해도 이 값이 false면 공짜로 안 나감)
    isDefault: boolean().default(false).notNull(),
    // category='terrain'에서만 의미 있음 — 캐릭터가 이 지형 위로 못 지나감(예: 물). 예전엔 "물
    // 타일(itemKey=2)"이 코드에 하드코딩된 유일한 막힘 지형이었는데, 이제 관리자가 상점 페이지에서
    // 새로 등록하는 지형마다 자유롭게 지정할 수 있음(RoomMap.vue/UserRoomEmbed.vue의 canEnterTile 참고)
    blocksMovement: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('items_category_key_idx').on(table.category, table.itemKey),
])

// 유저별 아이템 보유 현황. 아바타 파츠/지형처럼 "있다/없다"만 필요한 아이템도 count=1로 통일해서
// 다루고(0 또는 1), 소모품/일반 아이템은 count가 실제 개수 — 필드를 나누지 않아 다루기 단순함
export const userItems = pgTable('user_items', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    itemid: integer().notNull(),
    count: integer().default(1).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('user_items_userid_itemid_idx').on(table.userid, table.itemid),
])

// 출석체크 — 하루 한 번 눌러서 재화를 받음. claimedDate는 KST 달력 날짜 문자열("YYYY-MM-DD",
// server/utils/attendance.ts의 kstDateString)로 하루를 나눔 — 단일 한국 커뮤니티라 KST 자정
// 기준으로 통일(예전엔 UTC 자정 기준이었는데, KST 자정~오전 9시 사이엔 이미 다음날인데도 서버는
// "어제"로 계산해서 오출석 판정이 나는 문제가 있었음). streak/amount는 그 시점에 계산된 값을
// 그대로 저장해둬서(나중에 재계산 안 해도) 캘린더·이력 조회가 항상 그때 상태를 그대로 보여줌
export const attendanceClaims = pgTable('attendance_claims', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    serverid: integer().notNull(),
    claimedDate: text().notNull(),
    streak: integer().notNull(),
    amount: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('attendance_claims_userid_server_date_idx').on(table.userid, table.serverid, table.claimedDate),
])
