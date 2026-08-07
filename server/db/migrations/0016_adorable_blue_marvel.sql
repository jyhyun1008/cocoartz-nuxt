CREATE TABLE "custom_emojis" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "custom_emojis_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"shortcode" text NOT NULL,
	"imageUrl" text NOT NULL,
	"imageType" text NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_emojis_shortcode_unique" UNIQUE("shortcode")
);
