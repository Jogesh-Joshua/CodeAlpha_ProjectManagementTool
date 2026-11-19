# Orbit — Database Design (Reconciled Specification)

> PostgreSQL on Neon · CodeAlpha Task 3

---

## 1. Entity-Relationship Overview

```
users ──────────────────────────────────────────────────────────────┐
  │                                                                  │
  │ 1:N (creator, RESTRICT) 1:N (commenter)     1:N (recipient)     │
  ▼                       ▼                      ▼                  │
projects            task_comments           notifications           │
  │                       │                 (explicit FKs)          │
  │ 1:N                   │ N:1                                     │
  ▼                       ▼                                         │
project_members ◄── tasks (N:M via task_assignees) ◄───────────────┘
(role: owner/admin/member)
  ▲                       ▲
  └─────────┬─────────────┘
            │
      Cross-Table Integrity
  (task belongs to project AND user is member of project)
```

---

## 2. Reconciled Schema DDL

### 2.1 `schema_migrations` (Migration Ledger)

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         SERIAL PRIMARY KEY,
  version    VARCHAR(50) NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.2 `users`

```sql
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL CHECK (length(trim(name)) >= 2),
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color  VARCHAR(7)   NOT NULL DEFAULT '#5B5BD6',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique index on normalized email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
```

**Integrity Rules:**
- `password_hash` stores bcrypt hash (cost factor 12) only — never plaintext.
- Email is normalized (`email.trim().toLowerCase()`) on insertion and lookup.

---

### 2.3 `sessions`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id          VARCHAR(64) PRIMARY KEY, -- HMAC-SHA256 hex digest of 256-bit token
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
```

**Security Design:**
- Plaintext session tokens are never stored in PostgreSQL.
- Lookup queries hash the incoming cookie value with `SESSION_SECRET` before selecting.
- `data` column stores session-bound security metadata (such as `csrfToken`).

---

### 2.4 `projects`

```sql
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
```

**Owner Invariant:**
- Project creation transactionally creates both the `projects` row and a `project_members` row with `role = 'owner'`.
- `owner_id` is foreign-keyed with `ON DELETE RESTRICT` to prevent deleting a user who owns an active project.

---

### 2.5 `project_members`

```sql
-- Role ENUM safely defined via PostgreSQL catalog query
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_role') THEN
    CREATE TYPE project_role AS ENUM ('owner', 'admin', 'member');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role       project_role NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_user_id ON project_members (user_id);

-- Enforce exactly one owner per project at the database level (Migration 002)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_owner_per_project
  ON project_members (project_id)
  WHERE role = 'owner';
```

**Rules & Invariants:**
- `PRIMARY KEY (project_id, user_id)` guarantees uniqueness and indexes queries filtering by `project_id`.
- `idx_pm_user_id` indexes queries filtering projects by `user_id`.
- `idx_one_owner_per_project` guarantees no project can ever have more than one owner.
- The last owner of a project cannot be demoted or removed.

---

### 2.6 `tasks`

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

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
```

---

### 2.7 `task_assignees` (Cross-Table Integrity)

```sql
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id     UUID        NOT NULL,
  user_id     UUID        NOT NULL,
  project_id  UUID        NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (task_id, user_id),

  -- Integrity 1: Task must belong to the specified project
  CONSTRAINT fk_ta_task_project FOREIGN KEY (task_id, project_id)
    REFERENCES tasks (id, project_id) ON DELETE CASCADE,

  -- Integrity 2: User must be an existing member of that exact project
  CONSTRAINT fk_ta_user_project FOREIGN KEY (project_id, user_id)
    REFERENCES project_members (project_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ta_user_id ON task_assignees (user_id);
CREATE INDEX IF NOT EXISTS idx_ta_project_user ON task_assignees (project_id, user_id);
```

---

### 2.8 `task_comments`

```sql
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
```

---

### 2.9 `notifications`

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notif_type') THEN
    CREATE TYPE notif_type AS ENUM ('task_assigned', 'comment_on_task', 'added_to_project');
  END IF;
END $$;

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
```

---

## 3. Database Indexes Summary

| Table | Index | Target / Condition | Purpose |
|-------|-------|--------------------|---------|
| `users` | `idx_users_email_lower` | `UNIQUE (LOWER(email))` | Case-insensitive authentication lookup |
| `sessions` | `idx_sessions_user_id` | `(user_id)` | Query active user sessions |
| `sessions` | `idx_sessions_expires_at` | `(expires_at)` | Expired session garbage collection |
| `projects` | `idx_projects_owner_id` | `(owner_id)` | Owner project retrieval |
| `project_members` | `idx_pm_user_id` | `(user_id)` | Reverse lookup: user's projects |
| `project_members` | `idx_one_owner_per_project` | `UNIQUE (project_id) WHERE role = 'owner'` | Exactly one owner invariant |
| `tasks` | `idx_tasks_project_status` | `(project_id, status)` | Kanban board column queries |
| `tasks` | `idx_tasks_due_date` | `(due_date) WHERE due_date IS NOT NULL` | Overdue / upcoming deadline widgets |
| `task_assignees` | `idx_ta_user_id` | `(user_id)` | "My Tasks" across projects |
| `task_assignees` | `idx_ta_project_user` | `(project_id, user_id)` | Project member assignment lookups |
| `task_comments` | `idx_tc_task_created` | `(task_id, created_at)` | Ordered comment stream rendering |
| `task_comments` | `idx_tc_author_id` | `(author_id)` | Author comment tracking |
| `notifications` | `idx_notif_user_unread`| `(user_id, is_read, created_at DESC)`| User notification bell & drawer |
