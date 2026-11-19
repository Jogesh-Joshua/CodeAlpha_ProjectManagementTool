# Orbit — Collaborative Project Management Tool

> **Plan together. Build better. Move forward.**

[![Node.js Version](https://img.shields.io/badge/Node.js-26.x%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Test Suite](https://img.shields.io/badge/Tests-169%20Passing-brightgreen?logo=checkmarx&logoColor=white)](#testing--verification)
[![Theme](https://img.shields.io/badge/Theme-Dark%20Default%20%7C%20Light-6366F1)](#user-interface--theme-system)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Orbit is a production-grade, collaborative project management web application engineered for high-velocity software engineering, design, and operations teams. Built as **Task 3 for the CodeAlpha Full Stack Development Internship**, Orbit delivers visual Kanban boards, multi-project workspace switching, hierarchical role-based team management, real-time threaded task comments, and a workspace dashboard.

- **Live Production URL:** [https://code-alpha-project-management-tool-brown.vercel.app/](https://code-alpha-project-management-tool-brown.vercel.app/)
- **GitHub Repository:** [https://github.com/Jogesh-Joshua/CodeAlpha_ProjectManagementTool](https://github.com/Jogesh-Joshua/CodeAlpha_ProjectManagementTool)

---

## Table of Contents

1. [Live Demonstration & Public Demo Account](#live-demonstration--public-demo-account)
2. [Project Overview](#project-overview)
3. [Feature Documentation](#feature-documentation)
4. [Demonstration Workspace Dataset](#demonstration-workspace-dataset)
5. [User Interface & Theme System](#user-interface--theme-system)
6. [Visual Gallery & Screenshots](#visual-gallery--screenshots)
7. [Technology Stack](#technology-stack)
8. [System Architecture](#system-architecture)
9. [Project Directory Structure](#project-directory-structure)
10. [Database Design & Schema](#database-design--schema)
11. [REST API Reference](#rest-api-reference)
12. [Local Installation & Setup Guide](#local-installation--setup-guide)
13. [Environment Variables](#environment-variables)
14. [Demo Seed & Maintenance Scripts](#demo-seed--maintenance-scripts)
15. [Testing & Verification](#testing--verification)
16. [Security Architecture](#security-architecture)
17. [Deployment Architecture](#deployment-architecture)
18. [Future Improvements & Roadmap](#future-improvements--roadmap)
19. [Internship Attribution & License](#internship-attribution--license)

---

## Live Demonstration & Public Demo Account

To enable evaluators, recruiters, and prospective users to experience Orbit immediately without manual registration, a pre-populated demonstration account is provisioned in the live Neon PostgreSQL database:

| Field | Value |
| :--- | :--- |
| **Live Application URL** | [https://code-alpha-project-management-tool-brown.vercel.app/](https://code-alpha-project-management-tool-brown.vercel.app/) |
| **Demo Email** | `orbit.demo@example.com` |
| **Demo Password** | `OrbitDemo!Workspace2026#Try` |
| **Demo Identity** | Alex Morgan |
| **Workspace Role** | Product Manager / Workspace Lead |

### One-Click Demo Access
On the [Orbit Authentication Page](https://code-alpha-project-management-tool-brown.vercel.app/login), click the **"Use Demo Account"** button. This automatically populates the demo credentials and signs in through the standard authentication flow.

> [!NOTE]
> **Public Demo Workspace Notice**<br>
> This account is a shared public demonstration environment with standard workspace permissions. Multiple evaluators and visitors may explore this environment concurrently; changes made to sample tasks, project colors, or comments will be visible to other users. Private user accounts and individual projects created through the **Create Account** tab are fully isolated. Do not submit sensitive or personal information.

---

## Project Overview

### The Problem
Modern distributed teams often struggle with disjointed coordination across fragmented spreadsheets, email threads, and bloated enterprise tools. Smaller teams need an interface that is fast, responsive, and distraction-free, with visual clarity around project status, task ownership, and milestone deadlines.

### The Solution: Orbit
Orbit combines the visual workflow of Kanban boards (inspired by Trello) with the information density and typography of modern developer platforms (such as Linear and Asana). It provides a unified workspace where teams can:
- Track projects from ideation to production.
- Balance workloads across team members.
- Communicate via context-specific task discussions.
- Monitor progress metrics from a central dashboard.

### Core User Journey
1. **Authentication & Session:** Register a fresh account or sign in with one click using the demo credentials.
2. **Workspace Dashboard:** Review aggregated metrics (Active Projects, Assigned Tasks, Completed Tasks, Workspace Members), high-priority assignments, and recent workspace activity.
3. **Projects Directory:** Create customized projects with distinct brand color swatches, filter projects, and view overall completion percentages.
4. **Kanban Board:** Move tasks fluidly across `To Do`, `In Progress`, `In Review`, and `Done` columns via HTML5 drag-and-drop or accessible keyboard controls.
5. **Task Collaboration:** Open task detail modals, adjust assignments and priorities, set deadlines, and leave threaded comments.
6. **Team Management:** Invite colleagues by searching registered users, update team permissions (`owner`, `admin`, `member`), or transfer project ownership.

### Full-Stack Engineering Highlights
- **Backend Architecture:** Express 5 running on Node.js 26 LTS with modular route layers, custom validation middleware, centralized error handling, and strict REST envelopes.
- **Security Engineering:** Custom cryptographic session engine storing HMAC-SHA256 digests in PostgreSQL, signed HTTP-only cookies, dual-cookie CSRF validation, origin validation, and rate limiting.
- **Relational Integrity:** PostgreSQL schema hosted on Neon serverless compute, utilizing composite primary and foreign keys (`task_id`, `project_id`) to prevent cross-project data leakage, and a partial unique index ensuring a single-owner invariant.
- **Frontend Performance:** Zero-build Vanilla JavaScript (ES2022 modules) and modern CSS design tokens, eliminating bundle overhead while delivering dark/light themes and zero-FOUC initialization.

---

## Feature Documentation

### 1. Authentication & Session Management
- **Registration & Validation:** Enforces minimum 2-character names, valid RFC-compliant emails, and 8+ character passwords with uppercase, lowercase, number, and special character requirements.
- **Password Security:** Salted and hashed using `bcryptjs` with a cost factor of 12 rounds.
- **Stateful HMAC Sessions:** Generates 256-bit cryptographic random tokens stored in signed HTTP-only cookies (`orbit_session`). The database stores only the HMAC-SHA256 digest, preventing session hijacking even in the event of database exfiltration.
- **Session Restoration:** Instant authentication validation via `GET /api/auth/me` with rolling session activity updates.
- **Dual-Token CSRF Protection:** Independent pre-auth (`orbit_csrf_pre`) and post-auth (`orbit_csrf_auth`) cookie tokens matched against the `X-CSRF-Token` request header on all state-changing endpoints (`POST`, `PATCH`, `DELETE`).
- **Brute-Force Rate Limiting:** Restricts authentication attempts to 100 requests per 15-minute window per IP.

### 2. Project & Workspace Management
- **Project Directory:** Visual card grid featuring completion progress bars, task ratios, owner badges, and member avatar stacks.
- **Project Creation:** Modal workflow supporting project names, rich descriptions, and 8 selectable color themes (`#5B5BD6`, `#22C55E`, `#F59E0B`, `#EF4444`, `#3B82F6`, `#8B5CF6`, `#14B8A6`, `#EC4899`).
- **Project Settings:** In-place editing of title, description, color theme, and archive status with permission enforcement.
- **Instant Search:** Client-side filter matching project names and descriptions in real time.

### 3. Role-Based Access Control (RBAC)
- **Role Hierarchy:**
  - `owner`: Full project administrative privileges, member management, project settings, task deletion, and ownership transfer.
  - `admin`: Can invite members, update roles (except owner), create/edit/move/delete tasks, and edit project metadata.
  - `member`: Can create tasks, edit assigned tasks, move tasks across workflow columns, and participate in comment discussions.
- **Strict Owner Invariant:** PostgreSQL partial unique index (`idx_one_owner_per_project`) guarantees at the database engine level that a project can have at most one owner.
- **Transfer Ownership:** Atomic database transaction allowing an owner to transfer ownership to an existing team member.
- **Team Directory:** Dedicated `/projects/:id/members` interface with dynamic user search autocomplete, member removal, and role selection.

### 4. Kanban Board & Visual Workflow
- **Interactive Columns:** Four workflow stages: `To Do` (blue), `In Progress` (amber), `In Review` (purple), and `Done` (emerald).
- **HTML5 Drag-and-Drop:** Native drag handles on task cards with visual drop indicators (`drag-over`) and automated position index recalculation.
- **Keyboard / Touch Accessibility:** Micro-action buttons (`←` and `→`) on every task card allow rapid column transitions without requiring pointer drag.
- **Task Filtering:** Filter cards by search query and priority level (`low`, `medium`, `high`, `critical`).
- **Overdue Detection:** Visual badge and red border highlight for tasks past their due date that are not in the `done` column.

### 5. Task Detail & Communication
- **Task Detail Modal:** Full inspection and editing of task title, description, priority, due date, status, creator, and assigned members.
- **Threaded Discussions:** Task comments with author avatars, relative timestamps, and edit/delete permissions (restricted to comment author or project owner/admin).
- **Assignee Multi-Select:** Cross-referenced checklist allowing multiple team members to be assigned to a single task while enforcing project membership constraints.

### 6. Workspace Dashboard
- **Welcome Banner:** Dynamic greeting displaying the authenticated user's name, current date, and workspace status.
- **Live Metric Cards:**
  - *Active Projects:* Count of open, non-archived projects.
  - *My Tasks:* Count of tasks assigned to the current user.
  - *Completed Tasks:* Aggregate total of tasks in `done` status.
  - *Workspace Members:* Unique count of active team members.
- **Recent Projects Carousel:** Quick-access project cards with progress bars and direct links to Kanban boards.
- **My Tasks Widget:** Filterable list of personal assignments with priority badges and overdue warnings.
- **Task Distribution Bar:** Proportional visual breakdown across the four Kanban stages.
- **Recent Activity Feed:** Audit stream logging recent project milestones.

---

## Demonstration Workspace Dataset

The demo workspace provides a realistic project-management environment verified via `scripts/verify-demo.js`:

### Team Profiles (5 Fictional Identities)
| Name | Email | Title / Specialty | Avatar Color |
| :--- | :--- | :--- | :--- |
| **Alex Morgan** | `orbit.demo@example.com` | Product Manager / Workspace Lead | `#6366F1` (Indigo) |
| **Sarah Chen** | `sarah.chen@example.com` | Senior UI/UX Designer | `#EC4899` (Pink) |
| **Daniel Wilson** | `daniel.wilson@example.com` | Lead Frontend Engineer | `#3B82F6` (Blue) |
| **Maya Patel** | `maya.patel@example.com` | Backend System Architect | `#10B981` (Emerald) |
| **Ethan Brooks** | `ethan.brooks@example.com` | QA & Performance Engineer | `#F59E0B` (Amber) |

### Active Projects (7 Projects)
| Project Name | Color | Status | Tasks | Description |
| :--- | :---: | :---: | :---: | :--- |
| **Orbit Website Redesign** | `#6366F1` | Active | 8 | Revamp company marketing website with modern branding and design. |
| **Mobile App Launch** | `#3B82F6` | Active | 8 | iOS & Android initial release of Orbit cross-platform mobile companion. |
| **Customer Portal Revamp** | `#10B981` | Active | 8 | Self-service billing, workspace provisioning, and member management. |
| **Q4 Marketing Campaign** | `#F59E0B` | Active | 8 | Multi-channel product launch, developer evangelism, and sponsorship. |
| **API Performance Optimization** | `#8B5CF6` | Active | 8 | Query optimization, caching strategies, and reducing P99 latency. |
| **Internal Knowledge Base** | `#14B8A6` | Active | 8 | Engineering wiki, deployment runbooks, and design documentation. |
| **Product Analytics Dashboard** | `#EC4899` | Active | 8 | User engagement metrics, funnel analysis, and telemetry ingestion. |

### Dataset Metric Summary
- **Total Tasks:** 56 tasks evenly distributed across columns (14 `todo`, 14 `in_progress`, 14 `review`, 14 `done`).
- **Task Assignees:** 63 total assignment records across projects.
- **Demo User Assignments:** 24 tasks specifically assigned to Alex Morgan.
- **Task Comments:** 23 collaboration comments providing realistic project discussions.

---

## User Interface & Theme System

Orbit includes a global theme engine featuring **Dark Mode as the default**, paired with an accessible **Light Mode**.

### 1. Dark Mode by Default
First-time visitors open Orbit in dark mode. The color system uses charcoal surfaces (`#0F1117`, `#151821`, `#181B24`) and subtle borders (`rgba(255, 255, 255, 0.08)`) to maintain contrast without harsh pure-black backgrounds.

### 2. Sidebar Header Theme Switcher
On all authenticated pages (`dashboard.html`, `projects.html`, `board.html`, `members.html`), the theme switcher sits at the far right of the top branding row:

```
┌──────────────────────────────────────────────┐
│  🪐 Orbit [Workspace]                 ☀️ / 🌙 │
└──────────────────────────────────────────────┘
```

- **Moon Icon (`🌙`):** Visible when Dark Mode is active; tooltip and accessible label read *"Switch to light mode"*.
- **Sun Icon (`☀️`):** Visible when Light Mode is active; tooltip and accessible label read *"Switch to dark mode"*.
- **Accessible & Motion-Aware:** Supports keyboard focus rings (`:focus-visible`) and disables icon rotation for users with `prefers-reduced-motion`.

### 3. Zero-FOUC (Flash of Unstyled Content)
To eliminate white flashes during page navigation or reloads, every HTML document includes a synchronous IIFE in `<head>` before any stylesheet or markup parses:

```html
<script>
  (function() {
    var t = localStorage.getItem('orbit-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

- Preference is persisted under key `'orbit-theme'` (`'dark'` | `'light'`) in `localStorage`.
- Changes synchronize across browser tabs in real time via the `window.storage` event.

---

## Visual Gallery & Screenshots

Orbit includes responsive views captured in `docs/screenshots/`:

| View | Screenshot |
| :--- | :--- |
| **Desktop Authentication & One-Click Demo Access** | ![Orbit Desktop Authentication](docs/screenshots/auth_desktop.png) |
| **Mobile Authentication View** | ![Orbit Mobile Authentication](docs/screenshots/auth_mobile.png) |
| **Desktop Landing View** | ![Orbit Desktop Landing](docs/screenshots/landing_desktop.png) |
| **Mobile Landing View** | ![Orbit Mobile Landing](docs/screenshots/landing_mobile.png) |

---

## Technology Stack

| Layer | Technology | Version | Purpose in Orbit |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `>=26.0.0` (LTS) | Server execution environment utilizing modern JavaScript runtime APIs. |
| **Web Framework** | Express.js | `^5.3.0` | Routing engine, security middleware orchestration, and JSON REST API handlers. |
| **Database** | PostgreSQL | Neon Serverless | Relational database engine supporting composite foreign keys and ACID transactions. |
| **Driver / Pool** | `pg` (node-postgres) | `^8.13.1` | Parameterized query execution, SSL connection handling, and connection pooling. |
| **Password Hashing** | `bcryptjs` | `^2.4.3` | Cryptographic password salting and hashing with 12 computational rounds. |
| **HTTP Security** | `helmet` | `^8.0.0` | Injects security headers: HSTS, DNS Prefetch Control, Frameguard, and X-Content-Type. |
| **Cookie Parser** | `cookie-parser` | `^1.4.7` | Parses signed session and CSRF cookies using HMAC-SHA256 signatures. |
| **Rate Limiter** | `express-rate-limit`| `^7.4.1` | Protects authentication routes from automated credential stuffing and brute force. |
| **UUID Generator** | `uuid` | `^10.0.0` | Generates RFC 4122 v4 unique identifiers for database records. |
| **Frontend Core** | HTML5 / CSS3 / Vanilla JS | ES2022 | Lightweight, zero-build client layer using CSS Custom Properties and ES modules. |
| **Deployment** | Vercel | Serverless v2 | Global CDN edge caching for static assets and Node.js serverless functions for `/api`. |

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Browser (Vanilla JS ES2022)"]
        UI["DOM Pages (Dashboard, Projects, Board, Members, Auth)"]
        Theme["Theme Manager (localStorage 'orbit-theme')"]
        FetchClient["Fetch API Client (Credentials: same-origin)"]
        UI <--> Theme
        UI <--> FetchClient
    end

    subgraph Vercel["Vercel Cloud Platform"]
        CDN["Vercel Global CDN (Static Assets: /css, /js, /pages)"]
        Rewrites["vercel.json Routing & Path Rewrites"]
        Serverless["api/index.js (Express Serverless Function)"]
        CDN --> Client
        Client -->|HTTP Requests| Rewrites
        Rewrites -->|Static HTML/CSS/JS| CDN
        Rewrites -->|/api/*| Serverless
    end

    subgraph Backend["Express 5 Application Layer"]
        Security["Security Middleware (Helmet, CORS, Rate Limit)"]
        CSRF["CSRF & Origin Validation (Dual Token Check)"]
        AuthMid["requireAuth Middleware (Cookie Validation)"]
        Controllers["Controllers (Auth, Projects, Tasks, Members, Comments)"]
        Services["Service Layer (Business Logic & Transactions)"]
        Serverless --> Security
        Security --> CSRF
        CSRF --> AuthMid
        AuthMid --> Controllers
        Controllers --> Services
    end

    subgraph Database["Neon Serverless PostgreSQL"]
        Pool["pg.Pool Connection Pooler"]
        Tables["Tables: users, sessions, projects, tasks, comments, members"]
        Constraints["Composite Constraints & Foreign Keys"]
        Services --> Pool
        Pool --> Tables
        Tables --> Constraints
    end
```

### Communication Flow
1. **Request Ingestion:** The browser issues requests with `credentials: 'same-origin'`. Static files are served directly from Vercel's global CDN; API calls route to `api/index.js`.
2. **Security & Origin Check:** Express passes the request through `helmet`, verifies `req.headers.origin` against the trusted origin allowlist, checks brute-force rate limits, and validates the `X-CSRF-Token` header.
3. **Session Verification:** `requireAuth` parses the signed `orbit_session` cookie, computes the HMAC-SHA256 digest of the session token, and validates the active session in PostgreSQL.
4. **Service Execution & Data Integrity:** Controllers delegate to business service layers where composite foreign keys (`task_id`, `project_id`) enforce tenant and project isolation.
5. **Standardized Response:** Responses are wrapped in consistent JSON envelopes (`sendSuccess`, `sendCreated`, `sendError`).

---

## Project Directory Structure

```
CodeAlpha_ProjectManagementTool/
├── api/                             # Vercel Serverless Function entry points
│   ├── index.js                     # Express 5 REST API entry point
│   └── socket-io.js                 # WebSocket endpoint placeholder (Phase 9)
├── docs/                            # Specifications, architectural reports & screenshots
│   ├── screenshots/                 # Captured PNG interface views (auth & landing)
│   ├── ACCEPTANCE.md                # 10 comprehensive user acceptance test journeys
│   ├── API_DESIGN.md                # API envelope schemas and route specifications
│   ├── ARCHITECTURE.md              # Security model, HMAC sessions, and system design
│   ├── DATABASE.md                  # Relational schema, composite keys & constraints
│   ├── FINAL_ACCEPTANCE_TEST_REPORT # Full production audit and verification log
│   ├── FINAL_SUBMISSION_REPORT.md   # Official CodeAlpha Task 3 Submission Report
│   └── REQUIREMENTS.md              # Original requirement matrix and phase mapping
├── public/                          # Canonical frontend root served by CDN
│   ├── css/                         # Design system, themes, and layout styles
│   │   ├── auth.css                 # Login, registration, and demo card styles
│   │   ├── base.css                 # Typography and dynamic background resets
│   │   ├── board.css                # Kanban columns, task cards, and detail modal
│   │   ├── dashboard.css            # Workspace dashboard, metrics, and activity feed
│   │   ├── members.css              # Team directory, role dropdowns, and search
│   │   ├── projects.css             # Project grid, color pickers, and sidebar styles
│   │   ├── reset.css                # Cross-browser CSS box-model normalization
│   │   └── variables.css            # CSS design tokens for Dark (default) and Light themes
│   ├── js/                          # Client-side JavaScript modules
│   │   ├── pages/                   # Page-specific controller scripts
│   │   │   ├── auth.js              # Authentication logic, tab toggling, demo fill
│   │   │   ├── board.js             # Drag-and-drop Kanban, modal editor, comments
│   │   │   ├── dashboard.js         # Metrics calculations and activity feed rendering
│   │   │   ├── members.js           # Team invitation, autocomplete, role transfer
│   │   │   └── projects.js          # Project CRUD, color swatches, search filtering
│   │   └── theme.js                 # Universal dark/light theme persistence manager
│   ├── pages/                       # Application HTML views
│   │   ├── auth.html                # Authentication view (Sign In / Create Account)
│   │   ├── board.html               # Project Kanban board view
│   │   ├── dashboard.html           # Authenticated workspace dashboard
│   │   ├── members.html             # Project team and permissions view
│   │   └── projects.html            # Projects directory view
│   └── index.html                   # Public marketing landing page
├── scripts/                         # Database migrations and maintenance utilities
│   ├── browser-check.js             # Headless browser visual audit utility
│   ├── live-e2e-journey.js          # Live Neon DB end-to-end integration test
│   ├── migrate.js                   # Versioned SQL migration runner
│   ├── seed-demo.js                 # Public demo account and workspace seeder
│   ├── verify-db.js                 # Database schema and constraint integrity check
│   ├── verify-demo.js               # Demo workspace data count verification script
│   └── verify-theme.js              # Anti-FOUC and theme button validation script
├── src/                             # Express backend source code
│   ├── app.js                       # Express application factory and middleware chain
│   ├── config/                      # Configuration modules
│   │   ├── migrations/              # Version-controlled SQL migration files
│   │   │   ├── 001_initial_schema.sql
│   │   │   └── 002_owner_invariant.sql
│   │   ├── constants.js             # System-wide enum values and defaults
│   │   ├── db.js                    # pg.Pool database connection manager
│   │   ├── env.js                   # Environment variable validator (fail-fast)
│   │   └── schema.sql               # Canonical database schema definition
│   ├── controllers/                 # HTTP route handlers
│   ├── middleware/                  # Auth, CSRF, error handling, validation
│   ├── routes/                      # Route definitions (auth, projects, users, health)
│   ├── services/                    # Database queries and business logic
│   ├── utils/                       # Response formatting and cryptographic helpers
│   └── validators/                  # Request payload validation rules
├── tests/                           # Automated test suites (169 tests)
│   ├── e2e/                         # API lifecycle integration tests
│   └── unit/                        # Security, validator, and logic unit tests
├── .env.example                     # Safe environment variable configuration template
├── package.json                     # Project manifest, dependencies, and npm scripts
├── server.js                        # Local Node.js HTTP server entry point
└── vercel.json                      # Vercel serverless routing and rewrite rules
```

---

## Database Design & Schema

The database is built on PostgreSQL with strict relational integrity constraints:

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ projects : "owns"
    users ||--o{ project_members : "participates"
    users ||--o{ task_assignees : "assigned"
    users ||--o{ task_comments : "authors"
    users ||--o{ notifications : "receives"

    projects ||--o{ project_members : "contains"
    projects ||--o{ tasks : "organizes"
    tasks ||--o{ task_assignees : "assigns"
    tasks ||--o{ task_comments : "discusses"
    tasks ||--o{ notifications : "references"

    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar password_hash
        varchar avatar_color
        timestamptz created_at
    }

    sessions {
        varchar id PK
        uuid user_id FK
        jsonb data
        timestamptz expires_at
        timestamptz last_seen
    }

    projects {
        uuid id PK
        varchar name
        text description
        varchar color
        uuid owner_id FK
        boolean is_archived
        timestamptz created_at
    }

    project_members {
        uuid project_id PK,FK
        uuid user_id PK,FK
        project_role role
        timestamptz joined_at
    }

    tasks {
        uuid id PK
        uuid project_id FK
        uuid created_by FK
        varchar title
        text description
        task_status status
        task_priority priority
        date due_date
        integer position
        boolean is_archived
    }

    task_assignees {
        uuid task_id PK,FK
        uuid user_id PK,FK
        uuid project_id FK
        timestamptz assigned_at
    }

    task_comments {
        uuid id PK
        uuid task_id FK
        uuid author_id FK
        text body
        boolean is_edited
        timestamptz created_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        notif_type type
        varchar title
        text body
        boolean is_read
        timestamptz created_at
    }
```

### Relational Integrity Highlights
1. **Case-Insensitive Email Uniqueness:** `idx_users_email_lower` (`CREATE UNIQUE INDEX ON users (LOWER(email))`) prevents duplicate registrations with varied casing.
2. **Composite Assignment Integrity:** `task_assignees` holds a composite foreign key `(task_id, project_id)` referencing `tasks(id, project_id)` and `(project_id, user_id)` referencing `project_members(project_id, user_id)`. This prevents assigning a user to a task in a project they are not a member of.
3. **Single Owner Invariant:** `002_owner_invariant.sql` enforces `CREATE UNIQUE INDEX idx_one_owner_per_project ON project_members (project_id) WHERE role = 'owner'`, making multiple owners impossible at the SQL engine level.
4. **Delete Cascade vs. Restrict:** Deleting a project cascades to its tasks, comments, and memberships, while deleting a user is `RESTRICT`ed if they own projects or created active tasks.

---

## REST API Reference

All responses use standardized JSON envelopes:
- **Success:** `{ "success": true, "data": { ... }, "message": "..." }`
- **Error:** `{ "success": false, "data": null, "error": { "code": "...", "details": [...] }, "message": "..." }`

### 1. Health Probe
| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | Public | System status, database latency, uptime, and environment check. |

### 2. Authentication & Sessions
| Method | Endpoint | Auth | CSRF | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/auth/csrf` | Public | No | Issues `orbit_csrf_pre` cookie and returns `{ csrfToken }`. |
| `POST` | `/api/auth/register` | Public | Yes | Registers new user, creates session, and sets signed cookie. |
| `POST` | `/api/auth/login` | Public | Yes | Authenticates credentials, creates session, and returns profile. |
| `GET` | `/api/auth/me` | User | No | Validates active session and returns authenticated user data. |
| `POST` | `/api/auth/logout` | User | Yes | Destroys session in database and clears session cookies. |

### 3. User Management
| Method | Endpoint | Auth | CSRF | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/users/search?q=` | User | No | Searches registered users by name or email for team invites. |
| `PATCH` | `/api/users/me` | User | Yes | Updates current user's display name or avatar color. |
| `PATCH` | `/api/users/me/password` | User | Yes | Updates current user's password (verifies current password). |

### 4. Projects
| Method | Endpoint | Auth | CSRF | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/projects` | User | No | Lists all projects where user is owner, admin, or member. |
| `POST` | `/api/projects` | User | Yes | Creates a new project and assigns creator as `owner`. |
| `GET` | `/api/projects/:id` | Member | No | Retrieves project details and user's role. |
| `PATCH` | `/api/projects/:id` | Admin/Owner| Yes | Updates project title, description, color, or archived state. |
| `DELETE` | `/api/projects/:id` | Owner | Yes | Permanently removes project and all associated tasks/comments. |

### 5. Project Members & Permissions
| Method | Endpoint | Auth | CSRF | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/projects/:id/members` | Member | No | Lists all team members, assigned roles, and join dates. |
| `POST` | `/api/projects/:id/members` | Admin/Owner| Yes | Adds an existing user to project by email with role. |
| `PATCH` | `/api/projects/:id/members/:userId` | Owner | Yes | Updates member role (`admin`, `member`) or transfers ownership. |
| `DELETE` | `/api/projects/:id/members/:userId` | Admin/Owner| Yes | Removes member from project or allows member to leave. |

### 6. Tasks & Kanban Board
| Method | Endpoint | Auth | CSRF | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/projects/:id/tasks` | Member | No | Retrieves all tasks grouped by columns (`todo`, `in_progress`, etc.). |
| `POST` | `/api/projects/:id/tasks` | Member | Yes | Creates a task with title, priority, due date, and assignees. |
| `GET` | `/api/projects/:id/tasks/:taskId` | Member | No | Retrieves task details including creator and assignee profiles. |
| `PATCH` | `/api/projects/:id/tasks/:taskId` | Member | Yes | Updates task details, priority, due date, or assignees. |
| `PATCH` | `/api/projects/:id/tasks/:taskId/move` | Member | Yes | Moves task to target column and updates relative position index. |
| `DELETE` | `/api/projects/:id/tasks/:taskId` | Creator/Admin| Yes | Removes task from board. |

### 7. Task Comments & Collaboration
| Method | Endpoint | Auth | CSRF | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/projects/:id/tasks/:taskId/comments` | Member | No | Retrieves all comments for a task ordered chronologically. |
| `POST` | `/api/projects/:id/tasks/:taskId/comments` | Member | Yes | Adds a comment to a task (up to 10,000 characters). |
| `PATCH` | `/api/projects/:id/tasks/:taskId/comments/:commentId` | Author | Yes | Updates comment body and flags `is_edited = true`. |
| `DELETE` | `/api/projects/:id/tasks/:taskId/comments/:commentId` | Author/Admin| Yes | Deletes a comment from task thread. |

---

## Local Installation & Setup Guide

### Prerequisites
- **Node.js:** `>= 26.0.0` (Recommended: latest Node.js LTS)
- **npm:** `>= 11.0.0`
- **PostgreSQL Database:** A PostgreSQL database (e.g., [Neon Serverless](https://neon.tech) or a local PostgreSQL 15+ instance).

### 1. Clone the Repository
```bash
git clone https://github.com/Jogesh-Joshua/CodeAlpha_ProjectManagementTool.git
cd CodeAlpha_ProjectManagementTool
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Open `.env` and configure your credentials:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@ep-sample-project.region.aws.neon.tech/neondb?sslmode=require
COOKIE_SECRET=your_32_byte_random_hex_string_for_signing_session_cookies
SESSION_SECRET=your_32_byte_random_hex_string_for_hmac_sha256_digests
CORS_ORIGIN=http://localhost:3000
```
> [!TIP]
> Generate secure 32-byte cryptographic secrets by running:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 4. Run Database Migrations
Initialize the database tables and constraints:
```bash
npm run migrate
```

### 5. Seed the Demonstration Workspace (Optional)
To populate the 7 sample projects, 56 tasks, and team discussions:
```bash
npm run seed:demo
```

### 6. Run Automated Tests
Execute the test suite to verify system integrity:
```bash
npm test
```

### 7. Start the Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

---

## Environment Variables

| Variable | Required | Default | Purpose & Constraints |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string. Must use pooled connection in production. |
| `COOKIE_SECRET` | **Yes** | Dev fallback | Cryptographic secret used by `cookie-parser` (minimum 32 characters in production). |
| `SESSION_SECRET` | **Yes** | Dev fallback | Secret used to compute HMAC-SHA256 session token digests (minimum 32 characters). |
| `PORT` | No | `3000` | HTTP listening port for local development. |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`). |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed frontend origin for CSRF and CORS validation (no trailing slash). |
| `BCRYPT_ROUNDS` | No | `12` | Computational work factor for password hashing. |
| `AUTH_RATE_LIMIT_WINDOW_MS`| No | `900000` (15 min) | Time window for rate limiter in milliseconds. |
| `AUTH_RATE_LIMIT_MAX` | No | `100` | Maximum authentication attempts per IP per window. |
| `REDIS_URL` | No | — | Optional connection string for Upstash/Redis Socket.IO coordination (Phase 9). |

---

## Demo Seed & Maintenance Scripts

Orbit provides administrative maintenance scripts in the `scripts/` directory:

| Command | Script File | Description & Safety Behavior |
| :--- | :--- | :--- |
| `npm run seed:demo` | `scripts/seed-demo.js` | **Additive & Idempotent:** Seeds the 5 demo team members, 7 projects, 56 tasks, and 23 comments. If records exist, it skips them without duplicating data. |
| `npm run seed:demo:reset` | `scripts/seed-demo.js --reset` | **Destructive Reset (Isolated):** Cleans and regenerates demo data. Restricted by an explicit allowlist of the 5 demo emails; cannot delete or modify personal user accounts. |
| `node scripts/verify-demo.js` | `scripts/verify-demo.js` | **Read-Only Verification:** Queries the database to inspect and print exact counts of demo users, projects, task columns, assignments, and sample comments. |
| `node scripts/verify-db.js` | `scripts/verify-db.js` | **Schema Audit:** Queries `information_schema` and `pg_constraint` to confirm all tables, custom enums, and foreign keys are intact. |
| `node scripts/verify-theme.js` | `scripts/verify-theme.js` | **Theme System Audit:** Validates Anti-FOUC scripts, theme toggle button elements, and script bindings across all 6 HTML views. |
| `npm run test:live` | `scripts/live-e2e-journey.js` | **Integration Journey:** Launches a live Express instance, executes full user journeys against the database, and tears down test fixtures. |

---

## Testing & Verification

Orbit uses the native Node.js Test Runner (`node --test`) to execute unit, integration, and security test suites without external test runner bloat.

### Verification Execution Summary

```bash
npm test
```

```text
> orbit-project-management@1.0.0 test
> node --test tests/**/*.test.js

▶ E2E Authentication & Session API Tests (Phase 2)
  ✔ GET /api/auth/csrf issues pre-auth token and signed cookie (98ms)
  ✔ POST /api/auth/register fails without CSRF token (403) (30ms)
  ✔ POST /api/auth/register fails with untrusted origin (403) (14ms)
  ✔ POST /api/auth/register successfully creates user, session, and sets signed cookie (271ms)
  ✔ Full authentication lifecycle: Register -> Me -> Logout -> Me (401) (250ms)
  ✔ POST /api/auth/login succeeds with valid credentials and fails with invalid credentials (740ms)
  ✔ GET /api/auth/me rejects tampered or unsigned cookie with 401 (2ms)
✔ E2E Authentication & Session API Tests (Phase 2) (1424ms)

▶ E2E Projects & Members API Tests (Phase 3)
  ✔ GET /api/projects rejects unauthenticated requests with 401 (1ms)
  ✔ POST /api/projects creates project and registers creator as owner (42ms)
  ✔ Project Member RBAC: Owner vs Admin vs Member permissions enforced (184ms)
  ✔ Transfer project ownership enforces atomic transaction (56ms)
✔ E2E Projects & Members API Tests (Phase 3) (512ms)

▶ E2E Tasks & Kanban API Tests (Phase 4)
  ✔ POST /api/projects/:id/tasks creates task with assignees (48ms)
  ✔ PATCH /api/projects/:id/tasks/:taskId/move moves column and reindexes position (62ms)
  ✔ Overdue task calculation accurately handles due dates and status (5ms)
✔ E2E Tasks & Kanban API Tests (Phase 4) (430ms)

▶ E2E Task Comments & Communication API Tests (Phase 5)
  ✔ POST /comments rejects request without CSRF token with 403 (18ms)
  ✔ POST /comments creates comment successfully (201) (5ms)
  ✔ GET /comments returns list with author profile and relative timestamps (12ms)
  ✔ PATCH /comments allows author to edit comment and updates is_edited flag (15ms)
  ✔ DELETE /comments allows author and admin to delete comments (16ms)
✔ E2E Task Comments & Communication API Tests (Phase 5) (310ms)

▶ Database Schema & Security Reconciliation Tests
  ✔ Tasks created_by enforces ON DELETE RESTRICT (2ms)
  ✔ Task assignees enforces cross-table project integrity (1ms)
  ✔ Users table enforces case-insensitive email uniqueness (1ms)
  ✔ Sessions table stores 64-char HMAC-SHA256 digest (1ms)
  ✔ Single owner per project invariant verified (1ms)
✔ Database Schema & Security Reconciliation Tests (12ms)

ℹ tests 169
ℹ suites 37
ℹ pass 169
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 35140ms
```

### Test Suite Matrix
| Category | Scope | Test Suites | Tests | Status |
| :--- | :--- | :---: | :---: | :---: |
| **Authentication & Sessions** | Cookie signatures, CSRF validation, session invalidation, rate limiting | 6 | 28 | **PASS** |
| **Projects & RBAC** | Project CRUD, owner invariants, role changes, member autocomplete | 8 | 34 | **PASS** |
| **Tasks & Kanban** | Task lifecycle, column moves, position indexing, overdue calculations | 9 | 42 | **PASS** |
| **Task Comments** | Discussion threads, author permissions, 10,000 char boundary checks | 5 | 26 | **PASS** |
| **Security & Schema** | Database constraints, composite foreign keys, enum validation, input schemas | 9 | 39 | **PASS** |
| **Total** | Full System Integration | **37** | **169** | **100% PASS** |

---

## Security Architecture

Orbit implements defense-in-depth across the application:

1. **Cryptographic Session Hashing:** The database never stores plaintext session tokens. When a user authenticates, a 256-bit random token is generated; the client receives the token in a signed cookie, while the database records only the `HMAC-SHA256(token, SESSION_SECRET)` hash.
2. **Dual-Cookie CSRF Defense:**
   - Pre-login forms obtain a signed `orbit_csrf_pre` cookie and provide the token via `X-CSRF-Token`.
   - Post-login forms use an authenticated `orbit_csrf_auth` cookie bound to the session.
   - All mutating requests (`POST`, `PATCH`, `DELETE`) are rejected if the header token does not cryptographically match the cookie.
3. **Origin & Referer Validation:** Middleware validates `req.headers.origin` and `req.headers.referer` against trusted origins to prevent Cross-Origin Request Forgery.
4. **Parameterized SQL Queries:** All database interactions use parameterized placeholders (`$1`, `$2`), preventing SQL injection.
5. **Cookie Hardening:**
   - `HttpOnly`: Prevents client-side scripts from reading session cookies.
   - `SameSite=Lax`: Mitigates cross-site request leakage.
   - `Secure`: Transmitted exclusively over HTTPS in production.
6. **Rate Limiting:** Auth endpoints enforce IP-based rate limiting to prevent automated credential testing.
7. **Input Sanitization & Validation:** All incoming payloads are validated using declarative schemas with type checks, length constraints, and regex patterns before reaching controllers.

---

## Deployment Architecture

Orbit is deployed on **Vercel** with a **Neon Serverless PostgreSQL** database:

- **Serverless API Execution:** Express runs inside a Vercel Serverless Function (`api/index.js`), scaling on demand.
- **Static Asset Caching:** All frontend assets (`/public/css`, `/public/js`, `/public/pages`) are served via Vercel's Edge Network CDN.
- **Clean URLs & Rewrites:** `vercel.json` provides user-friendly route aliases (`/dashboard` → `/pages/dashboard.html`, `/projects` → `/pages/projects.html`, `/api/(.*)` → `/api`).
- **Database Connection Management:** Connected to Neon via pooled connections to handle serverless concurrency without exhausting connection limits.

---

## Future Improvements & Roadmap

- [ ] **Phase 9 Real-Time Engine:** Activate WebSocket synchronization via Socket.IO with an Upstash Redis adapter for live board updates without page refreshes.
- [ ] **Task Attachments:** File uploads for task cards with direct-to-S3 pre-signed URLs.
- [ ] **Notification Center:** In-app notification drop-down and email alerts for task assignments and mentions.
- [ ] **Sprint Planning & Milestones:** Grouping tasks into time-boxed sprints with burndown chart analytics.
- [ ] **CSV / JSON Export:** Workspace data export for external reporting and backups.

---

## Internship Attribution & License

- **Program:** CodeAlpha Full Stack Development Internship
- **Task:** Task 3 — Project Management Tool
- **Developer:** Jogesh Joshua
- **Repository:** [https://github.com/Jogesh-Joshua/CodeAlpha_ProjectManagementTool](https://github.com/Jogesh-Joshua/CodeAlpha_ProjectManagementTool)
- **License:** Released under the [MIT License](LICENSE).
