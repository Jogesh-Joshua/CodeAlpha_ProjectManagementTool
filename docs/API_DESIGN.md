# Orbit — REST API Design (Reconciled Specification)

> Base URL (development): `http://localhost:3000/api`
> Base URL (production): `https://<vercel-deployment-domain>/api`

---

## 1. Conventions & JSON Envelopes

### 1.1 Success Envelope (Including Delete Operations)

All successful requests return HTTP 200 (or 201 for resource creation) with a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "Human-readable confirmation message"
}
```

> **Note on Deletion (NFR-01):** DELETE endpoints return HTTP 200 with the deleted resource identifier in `data` and a success message, maintaining a consistent JSON envelope across the entire API.

### 1.2 Error Envelope

All client and server errors return an HTTP 4xx or 5xx code with a standard structure:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "message": "Human-readable explanation"
}
```

### 1.3 CSRF Protection Architecture

- **Origin Verification:** All state-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`) verify that `Origin` or `Referer` matches `CORS_ORIGIN`. Mismatched or untrusted origins are rejected with 403 `CSRF_ORIGIN_INVALID`.
- **Pre-Authentication CSRF Token:** Unauthenticated users retrieve a CSRF token via `GET /api/auth/csrf`. This endpoint sets a signed `orbit_csrf_pre` cookie and returns `{ csrfToken }`. Form submissions send this token in the `X-CSRF-Token` header.
- **Session-Bound CSRF Token:** Upon login or registration, a session-bound CSRF token is persisted in `sessions.data.csrfToken` and returned in the login response payload. All authenticated state-changing requests must present this token in the `X-CSRF-Token` header.
- **Constant-Time Verification:** All CSRF token comparisons utilize `crypto.timingSafeEqual`.
- **Safe Methods:** `GET`, `HEAD`, and `OPTIONS` remain usable without token requirements.

---

## 2. Health & Readiness Probe (Public)

### GET `/api/health`
Publicly accessible liveness and readiness probe.

**Response 200 (Healthy):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": "142s",
    "timestamp": "2026-11-19T17:30:00.000Z",
    "environment": "development",
    "nodeVersion": "v26.8.2",
    "database": {
      "connected": true,
      "latencyMs": 14
    }
  },
  "message": "Orbit API is operational"
}
```

---

## 3. Auth Endpoints (Phase 2 Implemented & Verified)

### GET `/api/auth/csrf`
Issues a pre-auth CSRF token cookie (`orbit_csrf_pre`) or returns the active session-bound CSRF token.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "csrfToken": "4a7f9b8c2d1e0f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"
  },
  "message": "Pre-auth CSRF token issued."
}
```

---

### POST `/api/auth/register`
Register a new user account within an atomic transaction (user creation + session creation).

**Headers Required:**
- `Content-Type: application/json`
- `X-CSRF-Token: <token>`
- Cookie: `orbit_csrf_pre=<signed_cookie>`

**Request body:**
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "password": "SecurePassword1!"
}
```

**Validation:**
- `name`: 2–100 characters.
- `email`: Normalized lowercase, valid email format, unique.
- `password`: Minimum 8 characters, min 1 uppercase, min 1 number.

**Response 201 (Sets signed `orbit_sid` cookie):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "e2f1b4a6-7d3c-4e8a-9f5b-1c2d3e4f5a6b",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "avatarColor": "#5B5BD6"
    },
    "csrfToken": "9b8c2d1e0f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a4a7f"
  },
  "message": "Account created successfully."
}
```

---

### POST `/api/auth/login`
Log in with email and password. Generates fresh random session token (preventing session fixation) and sets signed `orbit_sid` cookie.

**Headers Required:**
- `Content-Type: application/json`
- `X-CSRF-Token: <token>`
- Cookie: `orbit_csrf_pre=<signed_cookie>`

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "SecurePassword1!"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "e2f1b4a6-7d3c-4e8a-9f5b-1c2d3e4f5a6b",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "avatarColor": "#5B5BD6"
    },
    "csrfToken": "1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a4a7f9b8c2d1e0f3a5b6c7d8e9f0a"
  },
  "message": "Logged in successfully."
}
```

---

### GET `/api/auth/me`
Restores session state for authenticated user via signed `orbit_sid` cookie.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "e2f1b4a6-7d3c-4e8a-9f5b-1c2d3e4f5a6b",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "avatarColor": "#5B5BD6"
    },
    "csrfToken": "1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a4a7f9b8c2d1e0f3a5b6c7d8e9f0a"
  },
  "message": "Session active."
}
```

---

### POST `/api/auth/logout`
Invalidates session in PostgreSQL by HMAC digest and clears `orbit_sid` cookie.

**Headers Required:**
- `X-CSRF-Token: <session_csrf_token>`
- Cookie: `orbit_sid=<signed_session_cookie>`

**Response 200:**
```json
{
  "success": true,
  "data": {},
  "message": "Logged out successfully."
}
```

---

## 4. User Endpoints (Phase 3)

### GET `/api/users/search?q=<query>`
Search users by name or email to invite to a project.

---

### PATCH `/api/users/me`
Update profile display name.

---

### PATCH `/api/users/me/password`
Change account password. Requires verification of current password.

---

## 5. Project Endpoints (Phase 3)

### GET `/api/projects`
List projects the user is a member of, with member and task counts.

---

### POST `/api/projects`
Transactionally creates a project and owner membership.

---

### GET `/api/projects/:id`
Fetch single project detail with column counts and member roster.

---

### PATCH `/api/projects/:id`
Update project title, description, or color. Requires `owner` or `admin`.

---

### DELETE `/api/projects/:id`
Archive or delete project. Requires `owner`.

---

## 6. Project Members Endpoints (Phase 3)

### GET `/api/projects/:projectId/members`
List all members in the project with roles.

---

### POST `/api/projects/:projectId/members`
Add a member by registered email. Requires `owner` or `admin`.

---

### PATCH `/api/projects/:projectId/members/:userId`
Change member role. Requires `owner`. Cannot demote the last owner.

---

### DELETE `/api/projects/:projectId/members/:userId`
Remove member from project. Automatically removes their task assignments.

---

## 7. Task Endpoints (Phase 4)

### GET `/api/projects/:projectId/tasks`
Fetch all project tasks grouped by status (`todo`, `in_progress`, `review`, `done`) with assignee lists.

---

### POST `/api/projects/:projectId/tasks`
Create task. Enforces that assignees are valid project members.

---

### PATCH `/api/projects/:projectId/tasks/:taskId/move`
Move task to another Kanban column and position.

---

### DELETE `/api/projects/:projectId/tasks/:taskId`
Delete task. Requires `owner`, `admin`, or original `created_by` user.

---

## 8. Comments Endpoints (Phase 5)

### POST `/api/tasks/:taskId/comments`
Add a comment. Membership verified in project.

---

### PATCH `/api/tasks/:taskId/comments/:commentId`
Edit own comment.

---

### DELETE `/api/tasks/:taskId/comments/:commentId`
Delete comment. Allowed by author, or project `owner`/`admin`.

---

## 9. Notifications Endpoints (Phase 8)

### GET `/api/notifications`
Get user's notifications and unread count.

---

### PATCH `/api/notifications/read`
Mark one or all notifications as read.

---

## 10. Real-time Socket.IO Events (Phase 9)

- **Dedicated Path:** `/api/socket-io/socket.io`
- **Transport:** `['websocket']`
- **Rooms:** `project:<projectId>`, `user:<userId>`
