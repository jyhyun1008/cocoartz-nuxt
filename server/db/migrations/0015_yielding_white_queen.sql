ALTER TABLE "remote_feed_posts" ADD COLUMN "boostedByActorUrl" text;--> statement-breakpoint
ALTER TABLE "remote_feed_posts" ADD COLUMN "boostedByName" text;--> statement-breakpoint
ALTER TABLE "remote_feed_posts" ADD COLUMN "boostedByHandle" text;--> statement-breakpoint
ALTER TABLE "remote_feed_posts" ADD COLUMN "boostedByIconUrl" text;--> statement-breakpoint
ALTER TABLE "remote_timeline_posts" ADD COLUMN "boostedByActorUrl" text;--> statement-breakpoint
ALTER TABLE "remote_timeline_posts" ADD COLUMN "boostedByName" text;--> statement-breakpoint
ALTER TABLE "remote_timeline_posts" ADD COLUMN "boostedByHandle" text;--> statement-breakpoint
ALTER TABLE "remote_timeline_posts" ADD COLUMN "boostedByIconUrl" text;