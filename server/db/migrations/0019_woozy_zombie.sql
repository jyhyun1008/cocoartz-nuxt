CREATE TABLE "email_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"smtpHost" text,
	"smtpPort" integer DEFAULT 587,
	"smtpSecure" boolean DEFAULT false NOT NULL,
	"smtpUser" text,
	"smtpPassword" text,
	"fromAddress" text,
	"fromName" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
