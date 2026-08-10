ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emailVerificationToken" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emailVerificationTokenExpiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emailVerificationSentAt" timestamp with time zone;