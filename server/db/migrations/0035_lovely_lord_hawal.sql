CREATE TABLE "attendance_claims" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_claims_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"serverid" integer NOT NULL,
	"claimedDate" text NOT NULL,
	"streak" integer NOT NULL,
	"amount" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_claims_userid_server_date_idx" ON "attendance_claims" USING btree ("userid","serverid","claimedDate");