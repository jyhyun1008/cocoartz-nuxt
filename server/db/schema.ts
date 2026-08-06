import { pgTable, integer, timestamp, text, boolean, uniqueIndex } from 'drizzle-orm/pg-core'

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
})

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
    // 이 글이 로컬 게시판 글타래가 아니라, 팔로우 피드에 뜬 원격(remoteFeedPosts) 글에 대한
    // 내 답글일 때 그 원격 글의 objectId. 이 값이 있으면 게시판 목록/개인 타임라인에서는
    // 숨기고(replyto 기반 글타래가 아니므로 isNull(replyto) 필터로는 안 걸러짐), 원격 글
    // 상세보기 쪽 댓글창에서만 보여줌
    remoteParentObjectId: text(),
}, (table) => [
    uniqueIndex('posts_object_id_idx').on(table.objectId),
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
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('follows_userid_actor_idx').on(table.userid, table.followerActorUrl),
])

// 개인 알림함 — 우선 'follow' 타입만 사용하지만 향후 확장 대비 문자열 type으로 둠
export const notifications = pgTable('notifications', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    type: text().notNull(),
    actorUserId: integer(),
    read: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

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
])

export const reactions = pgTable('reactions', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    postid: integer().notNull(),
    emoji: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const chatReactions = pgTable('chat_reactions', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    chatid: integer().notNull(),
    emoji: text().notNull(),
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
})

// 유저 개인이 팔로우하는 원격(fediverse) 계정
export const remoteFollows = pgTable('remote_follows', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    targetActorUrl: text().notNull(),
    targetInbox: text().notNull(),
    targetHandle: text(),
    targetName: text(),
    targetIconUrl: text(),
    accepted: boolean().default(false).notNull(),
    followActivityId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('remote_follows_userid_target_idx').on(table.userid, table.targetActorUrl),
])

// 유저 개인 팔로잉 피드에 들어오는 원격 글
export const remoteFeedPosts = pgTable('remote_feed_posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userid: integer().notNull(),
    sourceActorUrl: text().notNull(),
    sourceHandle: text(),
    sourceName: text(),
    sourceIconUrl: text(),
    objectId: text().notNull(),
    content: text().notNull(),
    // 원격 글의 CW(content warning)/서두 텍스트. 없으면 null → 목록에서 본문 미리보기로 대체 표시
    summary: text(),
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
    objectId: text().notNull(),
    content: text().notNull(),
    summary: text(),
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
