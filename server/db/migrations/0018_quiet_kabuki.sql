CREATE TABLE "link_previews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "link_previews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"url" text NOT NULL,
	"kind" text DEFAULT 'generic' NOT NULL,
	"title" text,
	"description" text,
	"imageUrl" text,
	"siteName" text,
	"embedUrl" text,
	"fetchedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_previews_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "quoteUrl" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "linkUrl" text;--> statement-breakpoint
ALTER TABLE "remote_feed_posts" ADD COLUMN "quoteUrl" text;--> statement-breakpoint
ALTER TABLE "remote_feed_posts" ADD COLUMN "linkUrl" text;--> statement-breakpoint
ALTER TABLE "remote_timeline_posts" ADD COLUMN "quoteUrl" text;--> statement-breakpoint
ALTER TABLE "remote_timeline_posts" ADD COLUMN "linkUrl" text;