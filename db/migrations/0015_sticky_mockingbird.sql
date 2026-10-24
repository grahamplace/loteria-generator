CREATE TABLE "board_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"board_count" integer,
	"card_count" integer,
	"was_unlocked" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "amount_paid_cents" integer;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "amount_discount_cents" integer;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "amount_refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "promotion_code" text;--> statement-breakpoint
ALTER TABLE "board_exports" ADD CONSTRAINT "board_exports_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_exports" ADD CONSTRAINT "board_exports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_exports_board_id_idx" ON "board_exports" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "board_exports_user_id_idx" ON "board_exports" USING btree ("user_id");