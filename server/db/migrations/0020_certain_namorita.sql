CREATE TABLE "currency_balances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "currency_balances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"serverid" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lastCollectedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "currencyName" text DEFAULT '코코아';--> statement-breakpoint
CREATE UNIQUE INDEX "currency_balances_userid_serverid_idx" ON "currency_balances" USING btree ("userid","serverid");