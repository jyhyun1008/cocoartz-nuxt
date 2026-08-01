ALTER TABLE "rooms" ADD COLUMN "map" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "readrole" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "writerole" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "adminrole" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "rooms" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "map" text;