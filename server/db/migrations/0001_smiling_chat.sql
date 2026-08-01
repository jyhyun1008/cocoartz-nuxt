CREATE TABLE "timeline_actor" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timeline_actor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicKey" text NOT NULL,
	"privateKey" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_follows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timeline_follows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"targetActorUrl" text NOT NULL,
	"targetInbox" text NOT NULL,
	"targetHandle" text,
	"targetName" text,
	"targetIconUrl" text,
	"accepted" boolean DEFAULT false NOT NULL,
	"followActivityId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timeline_posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sourceActorUrl" text NOT NULL,
	"sourceHandle" text,
	"sourceName" text,
	"sourceIconUrl" text,
	"objectId" text NOT NULL,
	"content" text NOT NULL,
	"published" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_follows_target_url_idx" ON "timeline_follows" USING btree ("targetActorUrl");--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_posts_object_id_idx" ON "timeline_posts" USING btree ("objectId");