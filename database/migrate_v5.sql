-- ============================================================
-- Migration v5: Add gender column to participants table
-- Run this on an existing tc_events database.
-- Safe to run multiple times (IF NOT EXISTS guard on column add is not standard
-- MySQL syntax, but gender = NULL means existing rows are unaffected).
-- ============================================================

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS gender ENUM('male','female','other') NULL AFTER phone;
