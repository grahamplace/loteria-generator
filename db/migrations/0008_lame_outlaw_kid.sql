ALTER TABLE "cards" ADD COLUMN "preserve_original" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "crop_data" json;