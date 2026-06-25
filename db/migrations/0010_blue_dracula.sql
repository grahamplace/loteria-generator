CREATE TABLE "lifecycle_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"discount_code" text,
	"stripe_promotion_code_id" text,
	"resend_message_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	CONSTRAINT "lifecycle_emails_user_id_type_unique" UNIQUE("user_id","type")
);
--> statement-breakpoint
ALTER TABLE "lifecycle_emails" ADD CONSTRAINT "lifecycle_emails_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;