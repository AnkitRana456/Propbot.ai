-- Migration 0018: project media for chat triggers (spec section 6).
--
-- projects already has gallery, floor_plans, map_url, latitude, longitude. The chat media triggers also need:
--   * a dedicated list of "highlight photos" shown on the visitor's very first message
--   * a master plan image (site plan / project layout)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "highlight_photos" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "master_plan_url" text;
