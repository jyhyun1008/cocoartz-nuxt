ALTER TABLE "rooms" ADD COLUMN "isAnnouncement" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" text;