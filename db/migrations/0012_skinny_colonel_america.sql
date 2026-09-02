CREATE TABLE "game_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"called_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_calls_card_unique" UNIQUE("game_id","card_id"),
	CONSTRAINT "game_calls_sequence_unique" UNIQUE("game_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_token" text NOT NULL,
	"nickname" text NOT NULL,
	"board_card_ids" uuid[] NOT NULL,
	"board_key" text NOT NULL,
	"marked_card_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_players_board_unique" UNIQUE("game_id","board_key"),
	CONSTRAINT "game_players_nickname_unique" UNIQUE("game_id","nickname"),
	CONSTRAINT "game_players_token_unique" UNIQUE("game_id","player_token")
);
--> statement-breakpoint
CREATE TABLE "game_wins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"pattern_instance" integer NOT NULL,
	"won_on_sequence" integer NOT NULL,
	"won_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_wins_player_unique" UNIQUE("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"pattern" text NOT NULL,
	"joins_locked" boolean DEFAULT false NOT NULL,
	"auto_advance_seconds" integer,
	"next_call_due_at" timestamp,
	"claim_window_closes_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	"end_reason" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "game_calls" ADD CONSTRAINT "game_calls_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_calls" ADD CONSTRAINT "game_calls_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_wins" ADD CONSTRAINT "game_wins_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_wins" ADD CONSTRAINT "game_wins_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "games_one_active_per_set" ON "games" USING btree ("board_id") WHERE status <> 'ended';--> statement-breakpoint
CREATE INDEX "games_status_idx" ON "games" USING btree ("status");