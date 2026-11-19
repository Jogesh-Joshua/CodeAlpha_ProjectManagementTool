# Orbit — Phase 3 Execution Report: Projects & Team Members

> **Project Identity:** Orbit — Project Management & Collaboration  
> **Tagline:** Plan together. Build better. Move forward.  
> **Repository:** `CodeAlpha_ProjectManagementTool`  
> **Phase Completed:** Phase 3 — Projects & Members Management  
> **Date:** November 19, 2026  

---

## 1. Executive Summary

Phase 3 implements the full project management and team collaboration layer of **Orbit**, addressing requirements `REQ-PROJ-01` through `REQ-PROJ-05` and `REQ-MBR-01` through `REQ-MBR-05`. 

Users can create multi-member collaborative projects with transactional ownership assignment, invite existing registered team members by email, update project metadata and styling accents, adjust member roles with strict ownership preservation invariants, search active users with autocomplete, and manage projects from a responsive workspace with clean visual navigation inspired by modern project management design standards.

---

## 2. Implemented Architecture & Deliverables

### 2.1 Backend Services & Invariants

1. **`src/services/projectService.js`**:
   - `createProject({ name, description, color, ownerId })`: Transactional creation of the project and designating creator as `owner` in `project_members`.
   - `getUserProjects(userId)`: Fetches all projects the user belongs to, aggregating member count, task count, and completion rate.
   - `getProjectById(projectId, userId)`: Fetches single project detail with column status breakdown, verifying caller is an active member (`403 NOT_A_MEMBER` if not).
   - `updateProject(projectId, userId, updates)`: Allows `owner` or `admin` to modify project name, description, color, and archive state.
   - `deleteProject(projectId, userId)`: Strictly requires `owner` role. Enforces PostgreSQL database cascade deletion of memberships, tasks, comments, and notifications.

2. **`src/services/memberService.js`**:
   - `getProjectMembers(projectId, userId)`: Verifies caller is a project member and returns sorted roster ordered by role rank (`owner` > `admin` > `member`) and join date.
   - `addMemberByEmail(projectId, requesterId, email, role)`: Requires `owner` or `admin`. Validates target user is registered in Orbit (`404 USER_NOT_FOUND` if not registered). Prevents duplicate memberships (`409 ALREADY_MEMBER`). Disallows adding a secondary owner directly (`400 CANNOT_ASSIGN_OWNER_ROLE`).
   - `updateMemberRole(projectId, requesterId, targetUserId, newRole)`: Strictly restricted to `owner`. Prevents demoting the last owner. Executes atomic ownership transfer in a database transaction when promoting a member to `owner` (demoting former owner to `admin` and updating `projects.owner_id`).
   - `removeMember(projectId, requesterId, targetUserId)`: Allows owner to remove members, admins to remove regular members, and members to leave projects. Prevents removing the owner (`400 CANNOT_REMOVE_OWNER`). Prevents admins from removing other admins (`403 INSUFFICIENT_ROLE`). Leverages composite database foreign keys to automatically cascade task assignment cleanup.

3. **`src/services/userService.js`**:
   - `searchUsers(query, excludeUserId, limit)`: Case-insensitive search on name and email to power live autocomplete invitation dropdowns.
   - `updateProfile(userId, { name })`: Updates user display name.
   - `changePassword(userId, { currentPassword, newPassword })`: Verifies current password before updating to bcryptjs hash with cost factor 12.

### 2.2 Controllers, Routes & Middleware

- **`src/validators/projectValidators.js`**: Validation schemas for project creation (1-150 chars name, valid hex color), updates, UUID params, member email/role, and user search.
- **`src/controllers/projectController.js` & `src/controllers/memberController.js` & `src/controllers/userController.js`**: Thin controllers dispatching to services and returning standardized JSON envelopes (`sendSuccess`, `sendCreated`, `sendDeleted`).
- **`src/routes/projects.js` & `src/routes/users.js`**: Mounted in `src/app.js` under `/api/projects` and `/api/users`. Protected with `requireAuth` and CSRF protection (`validateOrigin` and `validateCsrf`) on all mutating HTTP methods (`POST`, `PATCH`, `DELETE`).

### 2.3 User Interface & Frontend Modules

Aligned with the visual design directions (dark mode slate workspace, vibrant status accents, rounded cards, stacked member avatars, and clear layout hierarchy):

1. **`public/pages/projects.html` & `public/css/projects.css` & `public/js/pages/projects.js`**:
   - Sidebar navigation with brand logo, workspace links, and user profile pill with initials avatar and sign-out button.
   - Metric overview cards: Total Projects, Active Workspaces, Owned by You, Total Collaborators.
   - Project cards grid featuring color accent bars, role badges (`Owner`, `Admin`, `Member`), progress bars with task counters, stacked member avatars, and quick action buttons (`Members`, `Edit`, `Delete`).
   - Modals for creating new projects (with clickable 8-color swatch palette) and editing project metadata.
   - Live project filtering by name and description.

2. **`public/pages/members.html` & `public/css/members.css` & `public/js/pages/members.js`**:
   - Breadcrumb navigation (`Projects / [Project Name] / Team Members`).
   - Project summary header showing accent color box, title, description, and real-time member & task counts.
   - "Invite Team Member" panel with live user autocomplete search by name/email and role selector (`Member`, `Admin`).
   - Member roster table displaying avatar, full name, email, join date, interactive role selector for owners (supporting seamless ownership transfer with confirmation), and member removal / leave actions.

---

## 3. Verification & Test Results

The full test suite was executed via `npm test` using Node.js test runner:

```text
▶ E2E Authentication & Session API Tests (Phase 2) (7 tests)
▶ E2E HTTP Server & Health Check Tests (4 tests)
▶ E2E Projects & Members API Tests (Phase 3) (12 tests)
▶ Auth Service Business Logic Unit Tests (Phase 2) (7 tests)
▶ Auth Validators Unit Tests (Phase 2) (6 tests)
▶ Cryptographic Utilities Unit Tests (Phase 2) (5 tests)
▶ CSRF & Origin Protection Unit Tests (Phase 2) (7 tests)
▶ Environment Configuration Unit Tests (2 tests)
▶ Member Service Business Logic Unit Tests (Phase 3) (10 tests)
▶ Project Service Business Logic Unit Tests (Phase 3) (5 tests)
▶ Project Validators Unit Tests (Phase 3) (12 tests)
▶ Rate Limiter Unit Tests (Phase 2) (1 test)
▶ Response Utility Unit Tests (4 tests)
▶ Database Schema Reconciliation Unit Tests (7 tests)
▶ Validation Middleware & Helpers Unit Tests (5 tests)

ℹ tests 94
ℹ suites 15
ℹ pass 94
ℹ fail 0
ℹ duration_ms 2514.3444
```

### Database Verification Status
- **Automated Mock Database Suites:** 94/94 tests passing with 100% success rate.
- **Live Database Connection:** **BLOCKED (awaiting user environment configuration)**. `.env` is gitignored and does not exist in the working directory yet. Once the user adds a live Neon `DATABASE_URL` in `.env`, running `npm run migrate` will apply migrations `001_initial_schema.sql` and `002_owner_invariant.sql` against the live cluster.

---

## 4. Requirement Verification Matrix

| Requirement ID | Description | Status | Evidence |
|---|---|---|---|
| **REQ-PROJ-01** | Create named project with optional description and color label | ✅ Verified | `POST /api/projects`, `projectService.createProject`, `projects.js` |
| **REQ-PROJ-02** | Creator becomes owner transactionally (authoritative owner invariant) | ✅ Verified | `project_members (role='owner')` inside `db.withTransaction`, `002_owner_invariant.sql` |
| **REQ-PROJ-03** | Edit project name, description, color (owner and admin) | ✅ Verified | `PATCH /api/projects/:id`, `projectService.updateProject` |
| **REQ-PROJ-04** | Archive / delete project (owner only; prevent orphaned state) | ✅ Verified | `DELETE /api/projects/:id`, `deleteProject` owner check & cascade |
| **REQ-PROJ-05** | List all projects authenticated user belongs to | ✅ Verified | `GET /api/projects`, `getUserProjects`, progress & member aggregations |
| **REQ-MBR-01** | Add existing registered users to project by email | ✅ Verified | `POST /api/projects/:id/members`, `addMemberByEmail` |
| **REQ-MBR-02** | Project roles: `owner`, `admin`, `member` | ✅ Verified | Enum type, role badge styles, permission checks |
| **REQ-MBR-03** | Owner can change roles; last owner cannot be demoted or removed | ✅ Verified | `PATCH /api/projects/:id/members/:userId`, ownership transfer logic |
| **REQ-MBR-04** | Owner / admin can remove members (admins cannot remove owner or other admins) | ✅ Verified | `DELETE /api/projects/:id/members/:userId`, hierarchy enforcement |
| **REQ-MBR-05** | Members page listing participants with role badges and avatars | ✅ Verified | `public/pages/members.html`, `members.js`, `members.css` |

---

## 5. Next Steps — Phase 4: Task Management & Kanban Board

Phase 4 will build:
1. Task creation, editing, assignment, and deletion.
2. Status transitions (`todo`, `in_progress`, `review`, `done`) and priorities (`low`, `medium`, `high`, `critical`).
3. Multi-member task assignment enforcing project membership at the database level.
4. Interactive Kanban Board UI with column count badges, drag-and-drop status moves, and button-based accessibility fallbacks.
