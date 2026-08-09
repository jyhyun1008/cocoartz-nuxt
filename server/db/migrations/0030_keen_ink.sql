ALTER TABLE "items" ADD COLUMN "blocksMovement" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- 이미 "물"(코드에 WATER_TILE_ID=2로 하드코딩돼있던 유일한 막힘 지형)로 등록된 기존 행은 새
-- 컬럼이 기본값(false)으로 깔리면 캐릭터가 그냥 지나가버리게 되므로, 예전 하드코딩과 동작이
-- 그대로 이어지도록 여기서 한 번 소급 적용함(이후 새로 등록하는 지형은 관리자가 직접 지정).
UPDATE "items" SET "blocksMovement" = true WHERE "category" = 'terrain' AND "itemKey" = '2';