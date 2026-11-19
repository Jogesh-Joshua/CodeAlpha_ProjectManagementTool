# Orbit — Requirements Checklist (Reconciled Specification)

> **Plan together. Build better. Move forward.**
> CodeAlpha Full Stack Development Internship — Task 3

---

## 1. Mandatory Feature Requirements

### 1.1 Authentication & Sessions (Phase 2 Verified)
- [x] REQ-AUTH-01 · User registration (name, email, password; normalized lowercase email)
- [x] REQ-AUTH-02 · Password hashing with bcryptjs (cost factor 12)
- [x] REQ-AUTH-03 · Login with email + password with session rotation
- [x] REQ-AUTH-04 · Session management via signed HTTP-only cookies (`orbit_sid`, signed with `COOKIE_SECRET`)
- [x] REQ-AUTH-05 · Server-side sessions stored in PostgreSQL: 256-bit cryptographic token hashed via HMAC-SHA256 (`SESSION_SECRET`); plaintext tokens are never stored
- [x] REQ-AUTH-06 · Logout — session invalidated in database and signed cookie cleared
- [x] REQ-AUTH-07 · Session restored on next visit (persistent login, 7-day TTL, rolling last_seen)
- [x] REQ-AUTH-08 · Protected routes redirect unauthenticated users / reject with standard 401 envelope
- [x] REQ-AUTH-09 · Genuine CSRF protection on state-changing requests (Origin/Referer header verification + CSRF token strategy)

### 1.2 Project Management (Phase 3 Verified)
- [x] REQ-PROJ-01 · Create a named project with optional description and color label
- [x] REQ-PROJ-02 · Project creator becomes owner transactionally (authoritative owner invariant)
- [x] REQ-PROJ-03 · Edit project name, description, color (owner and authorized admin)
- [x] REQ-PROJ-04 · Archive / delete a project (owner only; prevent orphaned state)
- [x] REQ-PROJ-05 · List all projects the authenticated user belongs to
- [x] REQ-PROJ-06 · Project detail page with Kanban board (Phase 4 Verified)

### 1.3 Team / Members (Phase 3 Verified)
- [x] REQ-MBR-01 · Add existing registered users to a project by email
- [x] REQ-MBR-02 · Project roles: `owner`, `admin`, `member`
- [x] REQ-MBR-03 · Owner can change member roles; last owner cannot be demoted or removed
- [x] REQ-MBR-04 · Owner / admin can remove members (admins cannot remove or demote owner)
- [x] REQ-MBR-05 · Members page listing all project participants with role badges and avatars

### 1.4 Task Management (Phase 4 Verified)
- [x] REQ-TASK-01 · Create a task inside a project with title, description, priority, due date
- [x] REQ-TASK-02 · Task statuses: `todo`, `in_progress`, `review`, `done`
- [x] REQ-TASK-03 · Task priorities: `low`, `medium`, `high`, `critical` (do not replace with urgent)
- [x] REQ-TASK-04 · Assign one or more project members to a task (enforce project membership at DB level)
- [x] REQ-TASK-05 · Move task between statuses (Kanban drag-and-drop or button-based fallback)
- [x] REQ-TASK-06 · Edit task details (title, description, priority, due date, assignees)
- [x] REQ-TASK-07 · Delete task (owner, admin, or task creator only)
- [x] REQ-TASK-08 · Task list / board view filtered by status column
- [x] REQ-TASK-09 · Task detail modal / page showing full information and assignees
- [x] REQ-TASK-10 · Task creator ownership preserved with `ON DELETE RESTRICT`

### 1.5 Comments (Phase 5 Verified)
- [x] REQ-CMT-01 · Post a text comment on any task the user can access (membership verified)
- [x] REQ-CMT-02 · Edit own comment
- [x] REQ-CMT-03 · Delete own comment (owner / admin can delete any comment)
- [x] REQ-CMT-04 · Comments ordered chronologically, newest at bottom
- [x] REQ-CMT-05 · Comment shows author avatar, name, and relative timestamp

### 1.6 Kanban Board UI (Phase 4 Verified)
- [x] REQ-KB-01 · Four columns: To Do / In Progress / Review / Done
- [x] REQ-KB-02 · Task cards show title, priority badge, assignee avatars, due date indicator
- [x] REQ-KB-03 · Drag-and-drop card between columns (updates status via API) with button fallback
- [x] REQ-KB-04 · Overdue tasks highlighted visually
- [x] REQ-KB-05 · Column task count badge

### 1.7 Dashboard (Scheduled for Phase 6)
- [ ] REQ-DASH-01 · Summary statistics: total projects, assigned tasks, overdue tasks
- [ ] REQ-DASH-02 · List of recent projects
- [ ] REQ-DASH-03 · List of tasks assigned to current user across all projects (My Tasks)
- [ ] REQ-DASH-04 · Upcoming deadlines widget

### 1.8 User Profile & Settings (Scheduled for Phase 6)
- [ ] REQ-PROF-01 · View and edit display name
- [ ] REQ-PROF-02 · Change password (requires current password confirmation)
- [ ] REQ-PROF-03 · Avatar initials generated from name with assigned brand palette color

---

## 2. Bonus Feature Requirements

### 2.1 Notifications (Scheduled for Phase 8)
- [ ] REQ-NOTIF-01 · In-app notification when a task is assigned to the user
- [ ] REQ-NOTIF-02 · In-app notification when someone comments on the user's task
- [ ] REQ-NOTIF-03 · In-app notification when user is added to a project
- [ ] REQ-NOTIF-04 · Unread notification count badge in sidebar
- [ ] REQ-NOTIF-05 · Mark notifications as read (individually or all)
- [ ] REQ-NOTIF-06 · Do not notify the actor for their own actions; use explicit task_id / project_id FKs

### 2.2 Real-time Updates (WebSockets via Socket.IO 4 — Scheduled for Phase 9)
- [ ] REQ-RT-01 · Dedicated WebSocket endpoint: `/api/socket-io/socket.io` with `transports: ['websocket']`
- [ ] REQ-RT-02 · Session authentication during WebSocket connection & room authorization
- [ ] REQ-RT-03 · Task status changes broadcast to all project members viewing the board
- [ ] REQ-RT-04 · New comments appear in real-time for all users viewing the task
- [ ] REQ-RT-05 · Real-time notification delivery to online user-specific room
- [ ] REQ-RT-06 · Exponential-backoff reconnection, automatic room rejoin, and REST state reload
- [ ] REQ-RT-07 · Shared Redis Pub/Sub coordination for multi-instance delivery

---

## 3. Non-Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| NFR-01 | Standard JSON envelope on all endpoints | ✅ Verified (Phase 1 & 2) |
| NFR-02 | Rate limiting on auth endpoints (100 req / 15 min) | ✅ Verified (Phase 2) |
| NFR-03 | Helmet security headers | ✅ Verified (Phase 1 & 2) |
| NFR-04 | No secrets committed (`.env` gitignored, separate cookie & session secrets) | ✅ Verified |
| NFR-05 | Input validation infrastructure | ✅ Verified (Phase 1 & 2) |
| NFR-06 | Parameterized SQL queries | ✅ Verified |
| NFR-07 | Responsive layout | In progress |
| NFR-08 | HTTPS / TLS | Production |
| NFR-09 | Production error hygiene (no stack traces) | ✅ Verified (Phase 1 & 2) |
| NFR-10 | Database integrity & composite constraints | ✅ Verified (Phase 1 & 2) |
| NFR-11 | Node.js 26.x LTS & Express.js 5 | ✅ Verified (Phase 1 & 2) |
