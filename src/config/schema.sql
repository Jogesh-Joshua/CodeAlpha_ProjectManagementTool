-- ============================================================
-- Orbit — Database Schema (Canonical Snapshot)
-- PostgreSQL (Neon Serverless)
-- Managed via versioned migrations in src/config/migrations/
-- Run: npm run migrate
-- ============================================================

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES (Standard PostgreSQL DO block checks)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_role') THEN
    CREATE TYPE project_role AS ENUM ('owner', 'admin', 'member');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notif_type') THEN
    CREATE TYPE notif_type AS ENUM ('task_assigned', 'comment_on_task', 'added_to_project');
  END IF;
END $$;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL CHECK (length(trim(name)) >= 2),
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color  VARCHAR(7)   NOT NULL DEFAULT '#5B5BD6',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- ============================================================
-- 2. SESSIONS (Stores HMAC-SHA256 digest of 256-bit token)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id          VARCHAR(64)  PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB        NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ============================================================
-- 3. PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL CHECK (length(trim(name)) >= 1),
  description TEXT,
  color       VARCHAR(7)   NOT NULL DEFAULT '#5B5BD6',
  owner_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_archived BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects (owner_id);

-- ============================================================
-- 4. PROJECT MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role       project_role NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_user_id ON project_members (user_id);

-- ============================================================
-- 5. TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by  UUID          NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  title       VARCHAR(255)  NOT NULL CHECK (length(trim(title)) >= 1),
  description TEXT,
  status      task_status   NOT NULL DEFAULT 'todo',
  priority    task_priority NOT NULL DEFAULT 'medium',
  due_date    DATE,
  position    INTEGER       NOT NULL DEFAULT 0,
  is_archived BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tasks_id_project UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks (project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date) WHERE due_date IS NOT NULL;

-- ============================================================
-- 6. TASK ASSIGNEES (Cross-table project integrity enforced)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id     UUID        NOT NULL,
  user_id     UUID        NOT NULL,
  project_id  UUID        NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id),
  CONSTRAINT fk_ta_task_project FOREIGN KEY (task_id, project_id)
    REFERENCES tasks (id, project_id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_user_project FOREIGN KEY (project_id, user_id)
    REFERENCES project_members (project_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ta_user_id ON task_assignees (user_id);
CREATE INDEX IF NOT EXISTS idx_ta_project_user ON task_assignees (project_id, user_id);

-- ============================================================
-- 7. TASK COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 10000),
  is_edited  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_task_created ON task_comments (task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tc_author_id ON task_comments (author_id);

-- ============================================================
-- 8. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notif_type   NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  link       VARCHAR(500),
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  actor_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID         REFERENCES projects(id) ON DELETE CASCADE,
  task_id    UUID         REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications (user_id, is_read, created_at DESC);
