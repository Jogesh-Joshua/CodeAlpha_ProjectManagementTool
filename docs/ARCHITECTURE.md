# Orbit — Application Architecture (Reconciled Specification)

> CodeAlpha Full Stack Development Internship — Task 3

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  HTML5 · CSS3 · Vanilla JavaScript (ES2022 modules)             │
│  Canonical root: public/                                        │
│  Pages: Landing · Auth · Dashboard · Projects · Board · Task    │
└─────────────────────┬───────────────────────────────────────────┘
                      │  HTTPS  (REST JSON + Dedicated WS Function)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               Vercel Serverless Platform                        │
│  · Static Assets served from public/                            │
│  · REST API served via Vercel Node.js Function (api/index.js)   │
│  · WebSocket served via Socket.IO Function (api/socket-io.js)   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Express.js 5 Application (src/app.js)              │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Middleware │  │   Routers    │  │      Controllers        │  │
│  │ · helmet   │  │ /api/health  │  │  authController        │  │
│  │ · cors     │  │ /api/auth    │  │  projectController     │  │
│  │ · cookie   │  │ /api/users   │  │  taskController        │  │
│  │ · rateLimit│  │ /api/projects│  │  commentController     │  │
│  │ · auth     │  │ /api/tasks   │  │  notificationController│  │
│  │ · csrf     │  │ /api/notifs  │  │  userController        │  │
│  │ · validate │  │              │  │                        │  │
│  └────────────┘  └──────────────┘  └────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │       Services Layer     │  │     Socket.IO 4 Coordinator  │ │
│  │  authService             │  │  · Session auth on connect   │ │
│  │  projectService          │  │  · Project rooms             │ │
│  │  taskService             │  │  · User rooms (notifs)       │ │
│  │  notificationService     │  │  · Optional Redis adapter    │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Data Access Layer (src/config/db.js)     │   │
│  │  pg Pool · Parameterized SQL · Transaction Runner        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │  TLS (Neon serverless pooler - port 5432)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               Neon Serverless PostgreSQL                         │
│  Tables: users · sessions · projects · project_members          │
│          tasks · task_assignees · task_comments · notifications  │
│          schema_migrations (ledger)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Reconciled Technology Stack

| Layer | Technology | Specification Details |
|-------|-----------|------------------------|
| Frontend | HTML5, CSS3, Vanilla JS ES2022 | Desktop-first responsive layout, modular ES scripts, no frameworks |
| Runtime | Node.js 26.x LTS | High-performance, modern LTS (`v26.8.2`) |
| Web Framework | Express.js 5 | Built-in async error delegation, standard routing (`5.3.0`) |
| Database | PostgreSQL via Neon | Serverless pooling, connection timeout management, SSL required |
| DB Driver | `pg` (node-postgres) | Native pooling, parameterized queries only |
| Authentication | bcryptjs + signed cookies | Cost factor 12; signed cookie with `COOKIE_SECRET` |
| Session Store | PostgreSQL `sessions` | HMAC-SHA256 hashed 256-bit token with `SESSION_SECRET` |
| Security | helmet, express-rate-limit | Strict CSP, XSS protection, anti-brute force, CSRF origin checking |
| Configuration | dotenv + `src/config/env.js` | Fail-fast startup configuration validator |
| Real-time (bonus) | Socket.IO 4 | Dedicated Vercel Function: `/api/socket-io/socket.io` |
| Migration Runner | Custom transaction runner | `scripts/migrate.js` + `schema_migrations` table |
| Deployment | Vercel | Vercel Node.js Serverless Functions (not Edge) |

---

## 3. Project Directory Structure

```
CodeAlpha_ProjectManagementTool/
│
├── api/                         ← Vercel Serverless Function entry points
│   ├── index.js                 ← Express REST API Function
│   └── socket-io.js             ← Dedicated Socket.IO WebSocket Function
│
├── docs/                        ← Specifications and reports
│   ├── REQUIREMENTS.md          ← Reconciled feature requirements
│   ├── ARCHITECTURE.md          ← System architecture (this document)
│   ├── DATABASE.md              ← Reconciled schema & DDL
│   ├── API_DESIGN.md            ← REST API & Socket.IO specification
│   ├── IMPLEMENTATION_PLAN.md   ← Phased development roadmap
│   ├── ACCEPTANCE.md            ← Acceptance test scenarios
│   ├── PHASE_1_REPORT.md        ← Phase 1 execution report
│   └── PHASE_2_REPORT.md        ← Phase 2 execution report
│
├── scripts/                     ← Utilities & automation
│   └── migrate.js               ← Versioned migration runner (schema_migrations)
│
├── src/                         ← Core backend source code
│   ├── app.js                   ← Reusable Express 5 application
│   ├── config/
│   │   ├── env.js               ← Fail-fast environment validator
│   │   ├── db.js                ← PostgreSQL connection pool & helpers
│   │   ├── constants.js         ← Application-wide constants
│   │   └── migrations/          ← Versioned SQL migration files
│   │       ├── 001_initial_schema.sql
│   │       └── 002_owner_invariant.sql
│   ├── middleware/
│   │   ├── auth.js              ← requireAuth & requireProjectRole
│   │   ├── csrf.js              ← validateOrigin & validateCsrf
│   │   ├── validate.js          ← Request validation infrastructure
│   │   └── errorHandler.js      ← Express 5 global error envelope handler
│   ├── routes/
│   │   ├── health.js            ← /api/health liveness/readiness probe
│   │   ├── auth.js              ← /api/auth routes (Phase 2 complete)
│   │   ├── users.js             ← /api/users routes (Phase 3)
│   │   ├── projects.js          ← /api/projects routes (Phase 3)
│   │   ├── tasks.js             ← /api/tasks routes (Phase 4)
│   │   ├── comments.js          ← /api/comments routes (Phase 5)
│   │   └── notifications.js     ← /api/notifications routes (Phase 8)
│   ├── controllers/
│   │   └── authController.js    ← Authentication endpoints controller
│   ├── services/
│   │   └── authService.js       ← User & session management logic
│   ├── validators/
│   │   └── authValidators.js    ← Register/login validation rules
│   ├── socket/                  ← Socket.IO event coordination (Phase 9)
│   └── utils/
│       ├── crypto.js            ← Bcrypt, HMAC-SHA256, session & CSRF tokens
│       ├── response.js          ← Standard JSON response envelope helpers
│       └── pagination.js        ← Pagination calculation helpers
│
├── public/                      ← Canonical frontend root (served static)
│   ├── index.html               ← Landing page entry
│   ├── css/
│   │   ├── variables.css        ← Orbit design tokens
│   │   ├── reset.css            ← CSS reset
│   │   ├── base.css             ← Base styles
│   │   └── auth.css             ← Authentication & card styles
│   ├── js/
│   │   ├── utils/               ← Client-side fetch & socket wrappers
│   │   ├── components/          ← Reusable UI components
│   │   └── pages/
│   │       ├── auth.js          ← Login/registration form management
│   │       └── dashboard.js     ← Session restoration & logout management
│   ├── pages/                   ← Application HTML views
│   │   ├── auth.html            ← Unified login & registration view
│   │   ├── dashboard.html       ← Dashboard workspace shell
│   │   ├── projects.html
│   │   ├── board.html
│   │   ├── task.html
│   │   ├── members.html
│   │   └── profile.html
│   └── assets/                  ← Static assets & icons
│
├── tests/                       ← Automated test suite (Node.js test runner)
│   ├── unit/                    ← Unit tests (crypto, authValidators, csrf, authService, etc.)
│   └── e2e/                     ← HTTP integration & server tests (health, auth)
│
├── server.js                    ← Local development server entry point
├── package.json                 ← Node 26.x & Express 5 dependencies
├── vercel.json                  ← Vercel serverless function & static rewrites
├── .env.example                 ← Documented environment variables template
├── .gitignore                   ← Git ignore rules
└── README.md                    ← Setup & usage documentation
```

---

## 4. Reconciled Authentication & Session Security

### 4.1 Token & Cookie Architecture

1. **Token Generation:** When a user logs in or registers, the server generates a cryptographically secure 256-bit random token (`crypto.randomBytes(32).toString('hex')`).
2. **Client Cookie:** The raw token is sent to the client in an HTTP-only cookie named `orbit_sid`, signed with `COOKIE_SECRET`. Cookie attributes:
   - `httpOnly: true`
   - `secure: true` (in production)
   - `sameSite: 'strict'`
   - `path: '/'`
   - `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days)
3. **Database Storage:** The raw token is **never** stored in PostgreSQL. Instead, the server computes an HMAC-SHA256 digest using `SESSION_SECRET` and stores the resulting 64-character hex digest as the primary key in the `sessions` table.
4. **Session Verification:** On incoming requests:
   - The cookie signature is validated using `COOKIE_SECRET`.
   - The verified token is hashed using HMAC-SHA256 with `SESSION_SECRET`.
   - The digest is queried against `sessions.id` where `expires_at > NOW()`.
   - If found, `last_seen` is updated and `req.user` and `req.session` are populated.
5. **Session Rotation & Invalidation:** On login, a fresh session token is issued (preventing session fixation). On logout, the session row is deleted from PostgreSQL and the cookie is cleared.

### 4.2 Genuine CSRF Protection

- **Origin Verification:** All state-changing requests (POST, PATCH, PUT, DELETE) verify that `Origin` or `Referer` matches `CORS_ORIGIN`. Mismatched or untrusted origins receive 403 `CSRF_ORIGIN_INVALID`.
- **Pre-Authentication CSRF Token:** Unauthenticated users retrieve a CSRF token via `GET /api/auth/csrf`. This endpoint sets a signed `orbit_csrf_pre` cookie and returns `{ csrfToken }`. Form submissions send this token in the `X-CSRF-Token` header.
- **Session-Bound CSRF Token:** Upon login or registration, a session-bound CSRF token is persisted in `sessions.data.csrfToken` and returned to the client. All authenticated state-changing requests must present this token in the `X-CSRF-Token` header.
- **Constant-Time Verification:** All CSRF token comparisons utilize `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
- **Safe Methods:** `GET`, `HEAD`, and `OPTIONS` remain usable without token requirements.

---

## 5. Deployment Architecture (Vercel)

- **Vercel Node.js Serverless Functions:** The REST API is packaged at `api/index.js` using Node.js 26.x runtime.
- **Dedicated WebSocket Function:** `api/socket-io.js` handles WebSocket upgrade connections via `/api/socket-io/socket.io`.
- **Static Delivery:** Vercel edge CDN serves files from `public/` directly for maximum speed and zero compute cost.
- **Rewrites in `vercel.json`:** Direct `/api/socket-io/:path*` to `api/socket-io.js`, `/api/:path*` to `api/index.js`, and all static paths to `public/`.
