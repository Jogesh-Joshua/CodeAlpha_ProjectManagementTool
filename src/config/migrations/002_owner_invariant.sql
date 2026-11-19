-- ============================================================
-- Migration 002: Enforce Project Owner Invariant
-- Ensures at the database level that each project can have at most one owner.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_owner_per_project
  ON project_members (project_id)
  WHERE role = 'owner';
