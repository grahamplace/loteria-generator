ALTER TABLE "user_profiles" ADD COLUMN "marketing_unsubscribed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "unsubscribe_token" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_unsubscribe_token_unique" UNIQUE("unsubscribe_token");