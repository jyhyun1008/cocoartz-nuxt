ALTER TABLE "users" ADD COLUMN "bannedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banReason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspendedUntil" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspendReason" text;