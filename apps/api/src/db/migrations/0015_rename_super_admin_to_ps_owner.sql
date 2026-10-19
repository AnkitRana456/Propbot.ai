-- Migration 0015: rename role 'super_admin' -> 'ps-owner' (business-logic spec section 2)
UPDATE "users" SET "role" = 'ps-owner' WHERE "role" = 'super_admin';
UPDATE "user_invitations" SET "role" = 'ps-owner' WHERE "role" = 'super_admin';
