ALTER TABLE "cards" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "default_card_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "cards_board_default_unique"
  ON "cards" ("board_id", "default_card_id")
  WHERE "default_card_id" IS NOT NULL;