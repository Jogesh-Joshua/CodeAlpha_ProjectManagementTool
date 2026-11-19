# Orbit — Implementation Roadmap (Reconciled Specification)

> CodeAlpha Task 3 · Phase 0 → Completion

---

## Overview

```
Phase 0  ·  Planning, Scaffolding & Spec Reconciliation  ✅ COMPLETE
Phase 1  ·  Backend Foundation, Migrations & Core Test   ✅ COMPLETE
Phase 2  ·  Authentication, Sessions & CSRF Protection   ✅ COMPLETE
Phase 3  ·  Projects, Roles & Member Management         ⏳ NEXT
Phase 4  ·  Tasks, Integrity & Kanban Drag-and-Drop     ⏳ UPCOMING
Phase 5  ·  Task Details, Comments & Communications     ⏳ UPCOMING
Phase 6  ·  Dashboard Analytics, My Tasks & Profile     ⏳ UPCOMING
Phase 7  ·  Responsive Polish, Brand Visual Identity    ⏳ UPCOMING
Phase 8  ·  In-App Notifications (Bonus)                ⏳ UPCOMING
Phase 9  ·  Socket.IO Real-time Collaboration (Bonus)   ⏳ UPCOMING
Phase 10 ·  Hardening, E2E Verification & Hand-off      ⏳ UPCOMING
```

---

## Phase 0 — Planning & Specification Reconciliation ✅

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| Clean Workspace Verification | Confirmed empty dedicated directory | ✅ Done |
| Reconciled Architecture | `docs/ARCHITECTURE.md` (Node 26, Express 5, Vercel Serverless) | ✅ Done |
| Reconciled Database Design | `docs/DATABASE.md` (Composite FKs, RESTRICT, HMAC sessions) | ✅ Done |
| Reconciled API Envelope & Design | `docs/API_DESIGN.md` (JSON envelope for all, 200 on DELETE) | ✅ Done |
| Reconciled Requirements | `docs/REQUIREMENTS.md` (All IDs preserved) | ✅ Done |
| Reconciled Acceptance Criteria | `docs/ACCEPTANCE.md` (10 user journeys + bonus) | ✅ Done |

---

## Phase 1 — Backend Foundation & Migrations ✅

| Milestone | File(s) | Status |
|-----------|---------|--------|
| Runtime & Dependencies | `package.json` (Node 26 LTS, Express 5.3.0, pg 8, helmet 8) | ✅ Done |
| Environment Validator | `src/config/env.js` (Fail-fast validation for secrets and config) | ✅ Done |
| Database Connection Pool | `src/config/db.js` (pg Pool with SSL, parameterization, transactions) | ✅ Done |
| Versioned Initial Migration | `src/config/migrations/001_initial_schema.sql` (8 tables, constraints) | ✅ Done |
| Migration Runner | `scripts/migrate.js` (using `schema_migrations` ledger) | ✅ Done |
| Standard Response Utility | `src/utils/response.js` (canonical success/error JSON envelopes) | ✅ Done |
| Request Validation Infra | `src/middleware/validate.js` (schema validation middleware) | ✅ Done |
| Express 5 Application | `src/app.js` (Helmet, CORS, cookie-parser, public static, health) | ✅ Done |
| Local Server | `server.js` (Graceful shutdown, process signal listeners) | ✅ Done |
| Vercel Function Entries | `api/index.js`, `api/socket-io.js`, `vercel.json` | ✅ Done |
| Automated Unit & E2E Tests | `tests/unit/*.test.js`, `tests/e2e/*.test.js` | ✅ Done |
| Phase 1 Execution Report | `docs/PHASE_1_REPORT.md` | ✅ Done |

---

## Phase 2 — Authentication, Sessions & CSRF ✅

**Goal:** Secure user registration, login, logout, HMAC-SHA256 session management, CSRF protection, and frontend auth views.

| Milestone | File(s) | Status |
|-----------|---------|--------|
| Cryptographic Utilities | `src/utils/crypto.js` (bcryptjs cost 12, 256-bit tokens, HMAC-SHA256, timingSafeEqual) | ✅ Done |
| Input Validators | `src/validators/authValidators.js` (Register and login schema validation) | ✅ Done |
| Auth Service | `src/services/authService.js` (Transactional register, login, session rotation, logout) | ✅ Done |
| CSRF & Origin Middleware | `src/middleware/csrf.js` (Origin check, session-bound and pre-auth CSRF validation) | ✅ Done |
| Auth Middleware | `src/middleware/auth.js` (`requireAuth` session cookie lookup and validation) | ✅ Done |
| Auth Controller & Routes | `src/controllers/authController.js`, `src/routes/auth.js` (Rate-limited /api/auth) | ✅ Done |
| Express Mounting | `src/app.js` (Mounted `/api/auth` and user routes `/login`, `/register`, `/dashboard`) | ✅ Done |
| Frontend Auth View | `public/pages/auth.html`, `public/css/auth.css`, `public/js/pages/auth.js` | ✅ Done |
| Dashboard Shell & Logout | `public/pages/dashboard.html`, `public/js/pages/dashboard.js` | ✅ Done |
| Owner Invariant Migration | `src/config/migrations/002_owner_invariant.sql` | ✅ Done |
| Automated Unit & E2E Tests | 55 automated tests passing across 11 test suites | ✅ Done |
| Phase 2 Execution Report | `docs/PHASE_2_REPORT.md` | ✅ Done |

---

## Phase 3 — Projects, Members & Role Invariants (Next)

**Goal:** Projects CRUD, member invitations, and role-based permissions.

| Milestone | File(s) | Scope |
|-----------|---------|-------|
| Project Service | `src/services/projectService.js` | Transactional project + owner creation |
| Project Controller & Routes | `src/controllers/projectController.js`, `src/routes/projects.js` | CRUD endpoints |
| Member Service & Routes | `src/services/memberService.js` | Add, change role, remove member |
| Role Middleware | `src/middleware/auth.js` | Owner / Admin / Member permission guard |
| Frontend Projects View | `public/pages/projects.html`, `public/js/pages/projects.js` | Project listing & creation modal |
| Frontend Members View | `public/pages/members.html`, `public/js/pages/members.js` | Member management table |
| Acceptance verification | AT-02, AT-03, AT-04 | Project creation, invite user, list |

---

## Phase 4 — Tasks, Assignee Integrity & Kanban Board (Completed)

**Goal:** Full task management with cross-table assignee integrity and Kanban drag-and-drop.
- Implemented task CRUD, position ordering, multi-assignee junction, HTML5 drag-and-drop board with accessible fallbacks.
- Verified with 130 automated tests passing.

---

## Phase 5 — Task Details & Comments (Completed)

**Goal:** Full task drawer modal and threaded team communications.
- Implemented nested REST routes (`GET`, `POST`, `PATCH`, `DELETE` at `/api/projects/:projectId/tasks/:taskId/comments`).
- Enforced project membership, task verification, author-only editing, and moderation rules (author, owner, admin can delete).
- Interactive comment thread UI with avatar, author info, relative timestamps, empty/loading/error states.
- Verified with 169 automated tests passing across 37 suites (39 tests added).

---

## Phase 6 — Dashboard & User Profile (Next)

**Goal:** Dashboard summary statistics, assigned tasks widget, and profile settings.

---

## Phase 7 — Responsive UI & Visual Polish

**Goal:** Complete responsive layouts and visual design tokens.

---

## Phase 8 — In-App Notifications (Bonus)

**Goal:** Bell notification drawer with event triggers.

---

## Phase 9 — Socket.IO Real-time Collaboration (Bonus)

**Goal:** Real-time updates over WebSocket Function `/api/socket-io/socket.io`.

---

## Phase 10 — Hardening, E2E Verification & Hand-off

**Goal:** Verify all 10 acceptance journeys, security regression checks, and student hand-off.
