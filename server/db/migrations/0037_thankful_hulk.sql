ALTER TABLE "users" ADD COLUMN "passwordResetToken" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordResetTokenExpiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordResetSentAt" timestamp with time zone;--> statement-breakpoint
-- 이메일 인증이 지금부터 실제 로그인 게이트가 되므로, 이 배포 이전에 이미 가입해서 "인증 안
-- 하면 배지만 뜸" 수준일 때 미인증 상태로 남아있던 기존 유저들을 여기서 한 번에 소급 인증
-- 처리함(emailVerifiedAt을 가입 시각으로 채움) — 안 하면 SMTP가 켜진 서버에서 이 배포 직후
-- 기존 유저 전원이 로그인이 막혀버림
UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;