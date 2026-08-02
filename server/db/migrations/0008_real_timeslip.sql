ALTER TABLE "posts" ADD COLUMN "remoteParentObjectId" text;--> statement-breakpoint
ALTER TABLE "remote_feed_posts" ADD COLUMN "liked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_feed_posts" ADD COLUMN "likeActivityId" text;