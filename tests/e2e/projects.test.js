'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../../src/app');
const db = require('../../src/config/db');

describe('E2E Projects & Members API Tests (Phase 3)', () => {
  let server;
  let baseUrl;

  let usersStore = [];
  let sessionsStore = [];
  let projectsStore = [];
  let membersStore = [];

  let aliceCookie = '';
  let aliceCsrf = '';
  let bobCookie = '';
  let bobCsrf = '';

  const aliceId = 'a0000000-0000-4000-8000-000000000001';
  const bobId = 'b0000000-0000-4000-8000-000000000002';
  const charlieId = 'c0000000-0000-4000-8000-000000000003';

  before(async () => {
    // Seed initial users
    usersStore = [
      {
        id: aliceId,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        avatar_color: '#5B5BD6',
      },
      {
        id: bobId,
        name: 'Bob Smith',
        email: 'bob@example.com',
        avatar_color: '#22C55E',
      },
      {
        id: charlieId,
        name: 'Charlie Davis',
        email: 'charlie@example.com',
        avatar_color: '#F59E0B',
      },
    ];

    // Seed mock sessions for Alice and Bob
    const aliceSessionToken = 'mock_alice_session_token_1234567890abcdef1234567890abcdef12345678';
    const bobSessionToken = 'mock_bob_session_token_1234567890abcdef1234567890abcdef1234567890';
    const { hashSessionToken } = require('../../src/utils/crypto');

    aliceCsrf = 'alice_csrf_token_secret_1234567890abcdef1234567890abcdef12345678';
    bobCsrf = 'bob_csrf_token_secret_1234567890abcdef1234567890abcdef12345678';

    sessionsStore = [
      {
        id: hashSessionToken(aliceSessionToken),
        user_id: aliceId,
        data: { csrfToken: aliceCsrf },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: hashSessionToken(bobSessionToken),
        user_id: bobId,
        data: { csrfToken: bobCsrf },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ];

    // Create signed cookies for HTTP requests
    const cookieSignature = require('cookie-signature');
    const env = require('../../src/config/env');
    aliceCookie = `orbit_sid=s%3A${encodeURIComponent(cookieSignature.sign(aliceSessionToken, env.COOKIE_SECRET))}`;
    bobCookie = `orbit_sid=s%3A${encodeURIComponent(cookieSignature.sign(bobSessionToken, env.COOKIE_SECRET))}`;

    // Setup Mock DB
    db.withTransaction = async (callback) => {
      const mockClient = {
        query: async (text, params) => {
          const sql = text.replace(/\s+/g, ' ').trim();

          if (sql.includes('INSERT INTO projects')) {
            const newProj = {
              id: 'd0000000-0000-4000-8000-000000000001',
              name: params[0],
              description: params[1],
              color: params[2],
              owner_id: params[3],
              is_archived: false,
              created_at: new Date(),
              updated_at: new Date(),
            };
            projectsStore.push(newProj);
            return { rows: [newProj] };
          }

          if (sql.includes('INSERT INTO project_members')) {
            const newM = {
              project_id: params[0],
              user_id: params[1],
              role: params[2],
              joined_at: new Date(),
            };
            membersStore.push(newM);
            return { rows: [newM] };
          }

          if (sql.includes('SELECT id, name, email, avatar_color FROM users WHERE id = $1')) {
            const u = usersStore.find((x) => x.id === params[0]);
            return { rows: u ? [u] : [] };
          }

          if (sql.includes("UPDATE project_members SET role = 'admin' WHERE project_id = $1 AND user_id = $2")) {
            const m = membersStore.find((x) => x.project_id === params[0] && x.user_id === params[1]);
            if (m) m.role = 'admin';
            return { rowCount: 1 };
          }

          if (sql.includes("UPDATE project_members SET role = 'owner' WHERE project_id = $1 AND user_id = $2")) {
            const m = membersStore.find((x) => x.project_id === params[0] && x.user_id === params[1]);
            if (m) m.role = 'owner';
            return { rowCount: 1 };
          }

          if (sql.includes('UPDATE projects SET owner_id = $1')) {
            const p = projectsStore.find((proj) => proj.id === params[1]);
            if (p) p.owner_id = params[0];
            return { rowCount: 1 };
          }

          return { rows: [] };
        },
      };
      return callback(mockClient);
    };

    db.query = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();

      // Session lookup
      if (sql.includes('SELECT s.id AS session_id')) {
        const session = sessionsStore.find((s) => s.id === params[0]);
        if (!session || new Date(session.expires_at) <= new Date()) return { rows: [] };
        const u = usersStore.find((user) => user.id === session.user_id);
        if (!u) return { rows: [] };
        return {
          rows: [
            {
              session_id: session.id,
              expires_at: session.expires_at,
              data: session.data,
              user_id: u.id,
              name: u.name,
              email: u.email,
              avatar_color: u.avatar_color,
            },
          ],
        };
      }

      if (sql.includes('UPDATE sessions SET last_seen')) {
        return { rowCount: 1 };
      }

      // User search
      if (sql.includes('FROM users WHERE (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1)')) {
        const term = params[0].replace(/%/g, '').toLowerCase();
        const matches = usersStore.filter(
          (u) =>
            (u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)) &&
            (!params[1] || u.id !== params[1])
        );
        return { rows: matches };
      }

      // User lookup by email
      if (sql.includes('SELECT id, name, email, avatar_color FROM users WHERE LOWER(email) = $1')) {
        const u = usersStore.find((x) => x.email.toLowerCase() === params[0].toLowerCase());
        return { rows: u ? [u] : [] };
      }

      // Projects list
      if (sql.includes('FROM projects p') && sql.includes('INNER JOIN project_members pm') && sql.includes('pm.user_id = $1')) {
        const userProjects = membersStore
          .filter((m) => m.user_id === params[0])
          .map((m) => {
            const p = projectsStore.find((proj) => proj.id === m.project_id);
            const owner = usersStore.find((u) => u.id === p.owner_id);
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              color: p.color,
              owner_id: p.owner_id,
              is_archived: p.is_archived,
              created_at: p.created_at,
              updated_at: p.updated_at,
              user_role: m.role,
              user_joined_at: m.joined_at,
              owner_name: owner?.name || 'Owner',
              owner_email: owner?.email || 'owner@example.com',
              owner_avatar_color: owner?.avatar_color || '#5B5BD6',
              member_count: membersStore.filter((x) => x.project_id === p.id).length,
              task_count: 0,
              completed_task_count: 0,
            };
          });
        return { rows: userProjects };
      }

      // Single project lookup
      if (sql.includes('SELECT p.id, p.name, p.description, p.color, p.owner_id') && sql.includes('WHERE p.id = $1')) {
        const p = projectsStore.find((proj) => proj.id === params[0]);
        if (!p) return { rows: [] };
        const owner = usersStore.find((u) => u.id === p.owner_id);
        return {
          rows: [
            {
              ...p,
              owner_name: owner?.name,
              owner_email: owner?.email,
              owner_avatar_color: owner?.avatar_color,
            },
          ],
        };
      }

      // Member check
      if (sql.includes('SELECT role, joined_at FROM project_members WHERE project_id = $1 AND user_id = $2')) {
        const m = membersStore.find((x) => x.project_id === params[0] && x.user_id === params[1]);
        return { rows: m ? [m] : [] };
      }

      if (sql.includes('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2')) {
        const m = membersStore.find((x) => x.project_id === params[0] && x.user_id === params[1]);
        return { rows: m ? [{ role: m.role }] : [] };
      }

      if (sql.includes('FROM tasks WHERE project_id = $1')) {
        return {
          rows: [
            {
              total_tasks: 0,
              todo_count: 0,
              in_progress_count: 0,
              review_count: 0,
              done_count: 0,
            },
          ],
        };
      }

      // Project members list
      if (sql.includes('FROM project_members pm') && sql.includes('INNER JOIN users u ON u.id = pm.user_id')) {
        if (sql.includes('WHERE pm.project_id = $1 AND pm.user_id = $2')) {
          const m = membersStore.find((x) => x.project_id === params[0] && x.user_id === params[1]);
          if (!m) return { rows: [] };
          const u = usersStore.find((user) => user.id === m.user_id);
          return {
            rows: [
              {
                role: m.role,
                name: u.name,
                email: u.email,
                avatar_color: u.avatar_color,
              },
            ],
          };
        }

        const list = membersStore
          .filter((m) => m.project_id === params[0])
          .map((m) => {
            const u = usersStore.find((user) => user.id === m.user_id);
            return {
              id: u.id,
              name: u.name,
              email: u.email,
              avatar_color: u.avatar_color,
              role: m.role,
              joined_at: m.joined_at,
            };
          });
        return { rows: list };
      }

      // Add member
      if (sql.includes('INSERT INTO project_members (project_id, user_id, role)')) {
        const newM = {
          project_id: params[0],
          user_id: params[1],
          role: params[2],
          joined_at: new Date(),
        };
        membersStore.push(newM);
        return { rows: [{ role: newM.role, joined_at: newM.joined_at }] };
      }

      // Update project
      if (sql.includes('UPDATE projects') && sql.includes('SET')) {
        const p = projectsStore.find((proj) => proj.id === params[params.length - 1]);
        if (!p) return { rows: [] };
        if (params.length >= 2) p.name = params[0];
        p.updated_at = new Date();
        return { rows: [p] };
      }

      // Update member role
      if (sql.includes('UPDATE project_members') && sql.includes('SET role = $1')) {
        const m = membersStore.find((x) => x.project_id === params[1] && x.user_id === params[2]);
        if (m) m.role = params[0];
        return { rows: [{ role: m.role }] };
      }

      // Delete member
      if (sql.includes('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2')) {
        membersStore = membersStore.filter(
          (m) => !(m.project_id === params[0] && m.user_id === params[1])
        );
        return { rowCount: 1 };
      }

      // Project check before delete
      if (sql.includes('SELECT id, name, owner_id FROM projects WHERE id = $1')) {
        const p = projectsStore.find((proj) => proj.id === params[0]);
        return { rows: p ? [p] : [] };
      }

      // Delete project
      if (sql.includes('DELETE FROM projects WHERE id = $1')) {
        projectsStore = projectsStore.filter((proj) => proj.id !== params[0]);
        membersStore = membersStore.filter((m) => m.project_id !== params[0]);
        return { rowCount: 1 };
      }

      return { rows: [] };
    };

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/projects requires authentication (rejects with 401)', async () => {
    const res = await fetch(`${baseUrl}/api/projects`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'NOT_AUTHENTICATED');
  });

  it('POST /api/projects rejects state-changing requests without CSRF token (403)', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
      },
      body: JSON.stringify({ name: 'Alpha' }),
    });
    assert.strictEqual(res.status, 403);
  });

  let createdProjectId = '';

  it('POST /api/projects creates project and returns 201 with standard envelope', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        name: 'Orbit Web Launch',
        description: 'New generation collaboration platform',
        color: '#6366F1',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.project.name, 'Orbit Web Launch');
    assert.strictEqual(body.data.project.userRole, 'owner');
    assert.strictEqual(body.data.project.memberCount, 1);
    createdProjectId = body.data.project.id;
  });

  it('GET /api/projects lists projects the user belongs to', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      headers: {
        'Cookie': aliceCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.projects.length, 1);
    assert.strictEqual(body.data.projects[0].name, 'Orbit Web Launch');
  });

  it('GET /api/projects/:id returns project details and status breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`, {
      headers: {
        'Cookie': aliceCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.project.name, 'Orbit Web Launch');
    assert.ok(body.data.project.tasksByStatus);
  });

  it('PATCH /api/projects/:id updates project details', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        name: 'Orbit Enterprise Launch',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.project.name, 'Orbit Enterprise Launch');
  });

  it('GET /api/users/search searches registered users by name or email', async () => {
    const res = await fetch(`${baseUrl}/api/users/search?q=charlie`, {
      headers: {
        'Cookie': aliceCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.users.length, 1);
    assert.strictEqual(body.data.users[0].name, 'Charlie Davis');
  });

  it('POST /api/projects/:id/members adds a member by email', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        email: 'charlie@example.com',
        role: 'member',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.member.name, 'Charlie Davis');
    assert.strictEqual(body.data.member.role, 'member');
  });

  it('GET /api/projects/:id/members lists project participants', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/members`, {
      headers: {
        'Cookie': aliceCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.members.length, 2);
  });

  it('PATCH /api/projects/:id/members/:userId updates member role', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/members/${charlieId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        role: 'admin',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.member.role, 'admin');
  });

  it('DELETE /api/projects/:id/members/:userId removes a member from project', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/members/${charlieId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.removed, true);
  });

  it('DELETE /api/projects/:id deletes project and returns 200 with standard envelope', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.deleted, true);
  });
});
