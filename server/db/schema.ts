import { pgTable, integer, timestamp, text } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: text().notNull(),
  knownas: text(),
  email: text().notNull().unique(),
  avatar: text(),
  bio: text(),
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
  userid: integer().notNull(),
  title: text().notNull(),
  content: text().notNull(),
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  history: text(),
  replyto: text(),
})
