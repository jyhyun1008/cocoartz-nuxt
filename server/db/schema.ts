import { pgTable, integer, timestamp, text, boolean, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    username: text().notNull().unique(),
    knownas: text(),
    email: text().notNull().unique(),
    password: text(),
    avatar: text(),
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
    serverid: integer().notNull(),
    roomid: integer().notNull(),
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
    published: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('remote_feed_posts_userid_object_idx').on(table.userid, table.objectId),
])
