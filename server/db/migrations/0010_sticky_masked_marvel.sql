CREATE TABLE "remote_timeline_post_likes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "remote_timeline_post_likes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"remoteTimelinePostId" integer NOT NULL,
	"userid" integer NOT NULL,
	"likeActivityId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_timeline_posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "remote_timeline_posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sourceActorUrl" text NOT NULL,
	"sourceInbox" text NOT NULL,
	"sourceHandle" text,
	"sourceName" text,
	"sourceIconUrl" text,
	"objectId" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"published" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "remote_timeline_post_likes_post_user_idx" ON "remote_timeline_post_likes" USING btree ("remoteTimelinePostId","userid");--> statement-breakpoint
CREATE UNIQUE INDEX "remote_timeline_posts_object_id_idx" ON "remote_timeline_posts" USING btree ("objectId");