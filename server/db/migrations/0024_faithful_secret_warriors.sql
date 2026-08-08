CREATE TABLE "word_mutes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "word_mutes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"pattern" text NOT NULL,
	"isRegex" boolean DEFAULT false NOT NULL,
	"level" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "word_mutes_userid_pattern_idx" ON "word_mutes" USING btree ("userid","pattern");