ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "account_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "boards" DROP CONSTRAINT IF EXISTS "boards_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "user_profiles_id_user_id_fk";--> statement-breakpoint

ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;--> statement-breakpoint

ALTER TABLE "session" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;--> statement-breakpoint

ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "boards" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint

ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;