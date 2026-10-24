ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "photo_mode" text DEFAULT 'illustrated' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "saved_illustration_url" text;