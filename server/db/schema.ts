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
    accepted: boolean().default(true).notNull(),
    followActivityId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('follows_userid_actor_idx').on(table.userid, table.followerActorUrl),
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

// 연합 타임라인 — 서버 전체가 공유하는 "@timeline" 서비스 액터가 팔로우하는 외부 계정들의 글 피드
export const timelineActor = pgTable('timeline_actor', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    publicKey: text().notNull(),
    privateKey: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const timelineFollows = pgTable('timeline_follows', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    targetActorUrl: text().notNull(),
    targetInbox: text().notNull(),
    targetHandle: text(),
    targetName: text(),
    targetIconUrl: text(),
    accepted: boolean().default(false).notNull(),
    followActivityId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('timeline_follows_target_url_idx').on(table.targetActorUrl),
])

export const timelinePosts = pgTable('timeline_posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sourceActorUrl: text().notNull(),
    sourceHandle: text(),
    sourceName: text(),
    sourceIconUrl: text(),
    objectId: text().notNull(),
    content: text().notNull(),
    published: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('timeline_posts_object_id_idx').on(table.objectId),
])
