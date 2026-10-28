ALTER TABLE "boards" ADD COLUMN "sheet_cards_found" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "from_sheet" boolean DEFAULT false NOT NULL;