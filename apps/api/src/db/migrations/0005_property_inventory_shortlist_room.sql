-- Phase 7: Property Inventory, Brochures & Smart Shortlist Room
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "overview" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "usps" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gallery" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "video_tour_url" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "floor_plans" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "price_sheet_url" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "payment_plans" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "offers" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "locality_insights" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_company_location_idx" ON "projects" USING btree ("company_id", "location");
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "facing" varchar(50);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "furnishing" varchar(50) DEFAULT 'unfurnished';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_company_bhk_price_idx" ON "units" USING btree ("company_id", "bhk", "price");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlist_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
	"lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
	"token" varchar(64) NOT NULL UNIQUE,
	"title" varchar(255) NOT NULL,
	"matched_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"total_time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"favorite_project_id" uuid REFERENCES "projects"("id") ON DELETE set null,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_rooms_company_lead_idx" ON "shortlist_rooms" USING btree ("company_id", "lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_rooms_token_idx" ON "shortlist_rooms" USING btree ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_rooms_expires_at_idx" ON "shortlist_rooms" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shortlist_id" uuid NOT NULL REFERENCES "shortlist_rooms"("id") ON DELETE cascade,
	"project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
	"unit_id" uuid REFERENCES "units"("id") ON DELETE set null,
	"order_index" integer DEFAULT 0 NOT NULL,
	"match_score" integer DEFAULT 100 NOT NULL,
	"match_highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_items_room_project_idx" ON "shortlist_items" USING btree ("shortlist_id", "project_id");
