-- Migration 0026: notifications can be archived (hidden from the bell) per user.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
