CREATE TABLE "actors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "actors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"publicKey" text NOT NULL,
	"privateKey" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boosts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "boosts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"postid" integer NOT NULL,
	"actorUrl" text NOT NULL,
	"actorName" text,
	"actorHandle" text,
	"actorIconUrl" text,
	"activityId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serverid" integer NOT NULL,
	"roomid" integer NOT NULL,
	"userid" integer NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"history" text,
	"replyto" text
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "follows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"followerActorUrl" text NOT NULL,
	"followerInbox" text NOT NULL,
	"accepted" boolean DEFAULT true NOT NULL,
	"followActivityId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "likes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer,
	"postid" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"remoteActorUrl" text,
	"remoteActorName" text,
	"remoteActorHandle" text,
	"remoteActorIconUrl" text,
	"activityId" text
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serverid" integer NOT NULL,
	"knownas" text,
	"role" text,
	"userid" integer NOT NULL,
	"avatar" text,
	"bio" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serverid" integer NOT NULL,
	"roomid" integer NOT NULL,
	"userid" integer,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"history" text,
	"replyto" text,
	"objectId" text,
	"remoteActorUrl" text,
	"remoteActorName" text,
	"remoteActorHandle" text,
	"remoteActorIconUrl" text,
	"remoteActorInbox" text
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"postid" integer NOT NULL,
	"emoji" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"path" text NOT NULL,
	"knownas" text NOT NULL,
	"type" text NOT NULL,
	"info" text,
	"map" text,
	"readrole" text,
	"writerole" text,
	"adminrole" text,
	"federated" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "servers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"themecolor" text,
	"avatar" text,
	"info" text,
	"rooms" text,
	"map" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"knownas" text,
	"email" text NOT NULL,
	"password" text,
	"avatar" text,
	"bio" text,
	"character" text,
	"map" text,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastLogin" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wiki_pages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serverid" integer NOT NULL,
	"roomid" integer NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"authorid" integer NOT NULL,
	"editorid" integer,
	"history" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "actors_userid_idx" ON "actors" USING btree ("userid");--> statement-breakpoint
CREATE UNIQUE INDEX "boosts_activity_id_idx" ON "boosts" USING btree ("activityId");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_userid_actor_idx" ON "follows" USING btree ("userid","followerActorUrl");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_activity_id_idx" ON "likes" USING btree ("activityId");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_object_id_idx" ON "posts" USING btree ("objectId");