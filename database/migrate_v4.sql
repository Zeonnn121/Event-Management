-- ============================================================
-- Migration v4: Council Member role
-- Run this on an existing tc_events database.
-- Safe to run multiple times (the ALTER is idempotent and the UPDATE is a no-op
-- once applied).
-- ============================================================

-- 1. Add the fourth role. council_member is someone a Council Lead adds to their
--    council: full read access like a member, but no management rights.
ALTER TABLE users
  MODIFY COLUMN role ENUM('super_admin','council_lead','council_member','member')
  NOT NULL DEFAULT 'member';

-- 2. Anyone already sitting in a council as a plain member was added by a
--    Council Lead, so they are council members under the new model.
UPDATE users SET role = 'council_member' WHERE role = 'member' AND council_id IS NOT NULL;
