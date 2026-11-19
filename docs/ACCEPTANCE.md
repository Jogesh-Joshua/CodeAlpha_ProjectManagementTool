# Orbit — Acceptance Test Suite (Reconciled Specification)

> Tests must be executed manually or through automated fixtures against a running server with a connected Neon database.
> Each test must pass before the project is submitted.

---

## Preconditions

- Server running on `http://localhost:3000` (or deployed Vercel URL)
- Neon database connected and schema applied via `npm run migrate`
- At least 2 test user accounts available: **User A** (owner) and **User B** (member)
- Browser DevTools open to verify network requests and cookies

---

## AT-01 · Register and Log In

**Scenario:** A new user registers and their session persists across page reloads.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/` (landing page) | Landing page loads with tagline and CTA |
| 2 | Click "Get Started" / "Register" | Auth page loads with register form |
| 3 | Fill: name="Test User A", email="usera@test.com", password="TestPassword1!" | Form accepts input |
| 4 | Submit form | `POST /api/auth/register` returns 201 with standard envelope; redirect to dashboard |
| 5 | Refresh the page | Still on dashboard — session restored via signed `orbit_sid` cookie |
| 6 | Open DevTools → Application → Cookies | `orbit_sid` cookie present, `httpOnly`, `SameSite=Strict` |
| 7 | Inspect database `sessions` table | Row exists where `id` equals HMAC-SHA256 digest of session token (plaintext token not stored) |

**Pass criteria:** No reload brings user back to login. Cookie is `httpOnly`. Database contains HMAC-SHA256 hash.

---

## AT-02 · Create a Group Project

**Scenario:** Authenticated user creates a named project and transactionally becomes its owner.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On dashboard, click "New Project" | Create project modal/form appears |
| 2 | Enter name="Orbit Test Project", description="Phase 0 test", pick colour | Form accepts input |
| 3 | Submit | `POST /api/projects` returns 201 with standard envelope; project appears in projects list |
| 4 | Click on the project | Project board page loads with 4 empty columns (To Do, In Progress, Review, Done) |
| 5 | Verify in DB | `SELECT * FROM projects WHERE name='Orbit Test Project'` — 1 row |
| 6 | Verify membership | `SELECT * FROM project_members WHERE project_id=<id> AND role='owner'` — user A is owner |

**Pass criteria:** Project visible in list; board loads; user is transactionally made `owner`.

---

## AT-03 · Add a User to the Project

**Scenario:** Owner adds User B to the project by email.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Register User B: email="userb@test.com" (separate browser / incognito) | User B account created |
| 2 | As User A, open project → Members | Members page shows only User A |
| 3 | Enter "userb@test.com" in Add Member field, submit | `POST /api/projects/:id/members` returns 201 |
| 4 | Members page refreshes | User B appears with role "member" |
| 5 | Log in as User B, check dashboard | Shared project appears in User B's project list |

**Pass criteria:** User B sees the project; User A sees B in member list with role.

---

## AT-04 · Open the Project Board

**Scenario:** Project board displays four Kanban columns.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | As User A, navigate to the project | Board page opens |
| 2 | Verify columns | "To Do", "In Progress", "Review", "Done" columns visible |
| 3 | Verify column count badges | All columns show "0 tasks" (empty project) |
| 4 | Check network requests | `GET /api/projects/:id/tasks` returns `{ todo: [], in_progress: [], review: [], done: [] }` in `data` |

**Pass criteria:** 4 columns rendered; API returns standard JSON envelope.

---

## AT-05 · Create a Task

**Scenario:** A project member creates a task from the board.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On board, click "+ Add Task" in "To Do" column | Task creation modal opens |
| 2 | Enter title="Design homepage", priority="high", due_date=next week | Form accepts |
| 3 | Submit | `POST /api/projects/:id/tasks` returns 201; card appears in "To Do" column |
| 4 | Card shows | Title, priority badge (High), due date indicator |
| 5 | Column count | "To Do" badge shows "1" |
| 6 | Verify DB | `created_by` has foreign key referencing User A with `ON DELETE RESTRICT` |

**Pass criteria:** Task card appears in correct column with correct metadata.

---

## AT-06 · Assign a Task to a Member

**Scenario:** Task is assigned to User B; database enforces project membership.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click the task card | Task detail panel/page opens |
| 2 | In "Assignees" section, click "+ Assign" | Member dropdown shows User A and User B |
| 3 | Select User B, save | `PATCH /api/projects/:id/tasks/:tid` with `assignee_ids` returns 200 |
| 4 | Close task detail, inspect board card | User B's avatar initials visible on card |
| 5 | Log in as User B, check "My Tasks" on dashboard | Task "Design homepage" appears |
| 6 | Try assigning a non-member via API | API rejects with 400 Bad Request; DB composite FK blocks non-member |

**Pass criteria:** Assignee avatar on card; task visible in User B's assigned list; cross-table integrity enforced.

---

## AT-07 · Change Task Status

**Scenario:** Dragging (or button-clicking) a card changes its status.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On board, drag "Design homepage" card to "In Progress" column | Card drops into column |
| 2 | `PATCH /api/projects/:id/tasks/:tid/move` with `status=in_progress` | Returns 200 with standard envelope |
| 3 | Reload the page | Card still in "In Progress" column |
| 4 | Verify DB | `SELECT status FROM tasks WHERE title='Design homepage'` → `in_progress` |

**Pass criteria:** Status persisted in DB; correct column after reload; button-based fallback functional.

---

## AT-08 · Add a Comment to a Task

**Scenario:** User posts a comment; it appears in the thread.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open task detail for "Design homepage" | Comment thread visible (empty) |
| 2 | Type "Looking good, let's start!" and submit | `POST /api/tasks/:tid/comments` returns 201 |
| 3 | Comment appears in thread | Shows User A's avatar, name, body, relative time |
| 4 | Log in as User B, open same task | Same comment visible |
| 5 | User B posts a reply: "On it!" | Second comment appears below |

**Pass criteria:** Comments persisted; visible to all project members.

---

## AT-09 · Track Project and Task Progress

**Scenario:** Dashboard and board reflect correct statistics.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create 3 more tasks with varied statuses (todo, in_progress, done) | — |
| 2 | Navigate to dashboard | "My Projects" shows Orbit Test Project |
| 3 | Task summary | Correct count of assigned tasks shown |
| 4 | Set one task due date = yesterday | Task highlighted as overdue on board |
| 5 | Overdue count | Dashboard "Overdue Tasks" count increments |

**Pass criteria:** Statistics accurate; overdue highlighting works.

---

## AT-10 · Log Out and Restore Session

**Scenario:** Session is properly invalidated on logout; restored correctly on next login.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | As User A, click "Logout" | `POST /api/auth/logout` returns 200 with standard envelope; redirect to login page |
| 2 | Check cookie | `orbit_sid` cookie cleared |
| 3 | Try accessing `/pages/dashboard.html` directly | Redirected back to login (cookie missing/expired) |
| 4 | Verify DB | `SELECT * FROM sessions WHERE user_id=<A>` → 0 rows |
| 5 | Log back in as User A | Redirect to dashboard; all projects and tasks still present |

**Pass criteria:** No session leakage; server-side session destroyed; data intact after logout + re-login.

---

## Bonus Acceptance Tests

### BAT-01 · Notifications

| Step | Expected |
|------|---------|
| User B is added to project | User B receives "added_to_project" notification |
| Task assigned to User B | User B sees notification badge increment |
| User B opens notifications panel | Notification listed, unread |
| User B marks as read | Badge disappears; notification marked read in DB |

### BAT-02 · Real-time Board Updates

| Step | Expected |
|------|---------|
| Open board in two browser windows (both logged in) | Both views load same board |
| In Window 1, create a new task | Task card appears in Window 2 without page reload |
| In Window 2, drag task to "In Progress" | Column updates in Window 1 without reload |
| In Window 1, post comment | Comment appears in Window 2's task detail in real-time |

---

## Regression Checks

Before final submission, verify:

- [ ] All 10 user journey tests pass
- [ ] No `401` on protected pages when logged in
- [ ] No `500` errors in server logs during normal usage
- [ ] No hardcoded credentials in any source file
- [ ] `.env` is in `.gitignore` and not committed
- [ ] All DB queries use parameterised statements
- [ ] `password_hash` never returned in any API response
- [ ] Rate limiter returns `429` after rapid auth requests
- [ ] Helmet headers present on all responses (`X-Content-Type-Options`, `Content-Security-Policy`, etc.)
- [ ] All deletion operations return HTTP 200 with standard JSON envelope (no empty 204)
