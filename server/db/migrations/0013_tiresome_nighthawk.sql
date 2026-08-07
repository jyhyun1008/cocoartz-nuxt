CREATE TABLE "mutes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mutes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userid" integer NOT NULL,
	"targetUserId" integer,
	"targetActorUrl" text,
	"targetActorName" text,
	"targetActorHandle" text,
	"targetActorIconUrl" text,
	"level" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mutes_userid_target_user_idx" ON "mutes" USING btree ("userid","targetUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "mutes_userid_target_actor_idx" ON "mutes" USING btree ("userid","targetActorUrl");