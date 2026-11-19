# Orbit — Project Management Tool

> **Plan together. Build better. Move forward.**

CodeAlpha Full Stack Development Internship — Task 3

---

## About Orbit

Orbit is a collaborative project management web application inspired by modern tools like Trello and Asana. It features project workspaces, Kanban boards, task assignment, team communication, and real-time updates.

**Tech Stack:**
- **Runtime:** Node.js 26.x LTS
- **Backend:** Express.js 5
- **Database:** PostgreSQL via Neon (Serverless)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES2022 modules)
- **Security:** bcryptjs, helmet, cookie-parser, express-rate-limit

---

## Prerequisites

- Node.js ≥ 26.0.0
- npm ≥ 11.0.0
- A [Neon](https://neon.tech) PostgreSQL database account

---

## Setup & Local Development

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/CodeAlpha_ProjectManagementTool.git
cd CodeAlpha_ProjectManagementTool

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and supply your DATABASE_URL, COOKIE_SECRET, and SESSION_SECRET

# 4. Apply versioned database migrations
npm run migrate

# 5. Run test suite
npm test

# 6. Start local development server
npm run dev
```

Navigate to `http://localhost:3000`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ (in prod) | Neon pooled PostgreSQL connection string |
| `COOKIE_SECRET` | ✅ | Cryptographic secret for signing session cookies (min 32 bytes) |
| `SESSION_SECRET` | ✅ | Cryptographic secret for HMAC-SHA256 hashing of session tokens (min 32 bytes) |
| `PORT` | ✗ | Local HTTP port (default: `3000`) |
| `NODE_ENV` | ✗ | `development`, `production`, or `test` |
| `CORS_ORIGIN` | ✗ | Allowed frontend origin (default: `http://localhost:3000`) |
| `BCRYPT_ROUNDS` | ✗ | Password hashing cost factor (default: `12`) |
| `AUTH_RATE_LIMIT_WINDOW_MS` | ✗ | Rate limiting window (default: `900000` = 15m) |
| `AUTH_RATE_LIMIT_MAX` | ✗ | Max requests per IP per window (default: `100`) |
| `REDIS_URL` | ✗ | Upstash/Redis connection for Socket.IO coordination (Phase 9) |

---

## Project Structure

```
CodeAlpha_ProjectManagementTool/
├── api/             ← Vercel Serverless Function entry points (index.js, socket-io.js)
├── docs/            ← Specifications, architecture, and phase execution reports
├── public/          ← Canonical frontend root (index.html, css/, js/, pages/)
├── scripts/         ← Migration runner (migrate.js) & maintenance scripts
├── src/             ← Reusable Express 5 application, config, middleware, routes
├── tests/           ← Automated unit and E2E tests (Node.js test runner)
├── server.js        ← Local development server
└── vercel.json      ← Vercel routing configuration
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | Full feature checklist with preserved IDs |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture & security specification |
| [DATABASE.md](docs/DATABASE.md) | Database schema, composite keys & integrity constraints |
| [API_DESIGN.md](docs/API_DESIGN.md) | REST API endpoints & JSON envelope reference |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phased roadmap & implementation milestones |
| [ACCEPTANCE.md](docs/ACCEPTANCE.md) | 10 acceptance journeys & test procedures |
| [PHASE_1_REPORT.md](docs/PHASE_1_REPORT.md) | Phase 1 execution report & test evidence |
| [PHASE_2_REPORT.md](docs/PHASE_2_REPORT.md) | Phase 2 execution report (Auth & Sessions) |
| [PHASE_3_REPORT.md](docs/PHASE_3_REPORT.md) | Phase 3 execution report (Projects & Members) |
| [PHASE_4_REPORT.md](docs/PHASE_4_REPORT.md) | Phase 4 execution report (Tasks & Kanban) |
| [PHASE_5_REPORT.md](docs/PHASE_5_REPORT.md) | Phase 5 execution report (Task Comments) |
| [FINAL_SUBMISSION_REPORT.md](docs/FINAL_SUBMISSION_REPORT.md) | Comprehensive CodeAlpha Task 3 Submission Report |

---

## Deployment (Vercel)

The project is structured for Vercel Serverless deployment:
- `api/index.js` serves the Express 5 REST API as a Node.js Function.
- `api/socket-io.js` serves the dedicated WebSocket Function for real-time collaboration.
- `public/` assets are served directly through Vercel's global CDN.

---

## License

MIT — CodeAlpha Internship Project
