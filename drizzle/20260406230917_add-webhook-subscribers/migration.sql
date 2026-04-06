CREATE TABLE "webhook_subscriber" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_settings" DROP COLUMN "webhook_callback_url";--> statement-breakpoint
ALTER TABLE "ledger_settings" DROP COLUMN "webhook_secret";