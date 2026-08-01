CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"type" text NOT NULL,
	"actorUserId" integer,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_feed_posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "remote_feed_posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"sourceActorUrl" text NOT NULL,
	"sourceHandle" text,
	"sourceName" text,
	"sourceIconUrl" text,
	"objectId" text NOT NULL,
	"content" text NOT NULL,
	"published" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_follows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "remote_follows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"targetActorUrl" text NOT NULL,
	"targetInbox" text NOT NULL,
	"targetHandle" text,
	"targetName" text,
	"targetIconUrl" text,
	"accepted" boolean DEFAULT false NOT NULL,
	"followActivityId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follows" ADD COLUMN "followerUserId" integer;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "registrationMode" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "remote_feed_posts_userid_object_idx" ON "remote_feed_posts" USING btree ("userid","objectId");--> statement-breakpoint
CREATE UNIQUE INDEX "remote_follows_userid_target_idx" ON "remote_follows" USING btree ("userid","targetActorUrl");