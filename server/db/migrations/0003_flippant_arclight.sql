CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serverid" integer NOT NULL,
	"roomid" integer NOT NULL,
	"userid" integer NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"history" text,
	"replyto" text
);
--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "replyto" text;