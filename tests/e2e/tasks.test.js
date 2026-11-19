'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../../src/app');
const db = require('../../src/config/db');

describe('E2E Task Management & Kanban API Tests (Phase 4)', () => {
  let server;
  let baseUrl;

  const projectId = 'd1111111-1111-4111-8111-111111111111';
  const aliceId = 'a1111111-1111-4111-8111-111111111111'; // Owner
  const bobId = 'b2222222-2222-4222-8222-222222222222';   // Member

  let aliceCookie = '';
  let aliceCsrf = '';
  let bobCookie = '';
  let bobCsrf = '';

  let usersStore = [];
  let sessionsStore = [];
  let projectsStore = [];
  let membersStore = [];
  let tasksStore = [];
  let assigneesStore = [];

  let createdTaskId = '';

  before(async () => {
    usersStore = [
      { id: aliceId, name: 'Alice Owner', email: 'alice@example.com', avatar_color: '#5B5BD6' },
      { id: bobId, name: 'Bob Member', email: 'bob@example.com', avatar_color: '#22C55E' },
    ];

    projectsStore = [
      {
        id: projectId,
        name: 'Website Launch',
        description: 'Launch Q4 site',
        color: '#6366F1',
        owner_id: aliceId,
        is_archived: false,
      },
    ];

    membersStore = [
      { project_id: projectId, user_id: aliceId, role: 'owner' },
      { project_id: projectId, user_id: bobId, role: 'member' },
    ];

    // Seed sessions
    const aliceToken = 'mock_alice_session_token_phase4_1234567890abcdef1234567890abcdef';
    const bobToken = 'mock_bob_session_token_phase4_1234567890abcdef1234567890abcdef123';
    const { hashSessionToken } = require('../../src/utils/crypto');

    aliceCsrf = 'alice_csrf_token_secret_phase4_1234567890abcdef1234567890abcdef';
    bobCsrf = 'bob_csrf_token_secret_phase4_1234567890abcdef1234567890abcdef1234';

    sessionsStore = [
      {
        id: hashSessionToken(aliceToken),
        user_id: aliceId,
        data: { csrfToken: aliceCsrf },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: hashSessionToken(bobToken),
        user_id: bobId,
        data: { csrfToken: bobCsrf },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ];

    const cookieSignature = require('cookie-signature');
    const env = require('../../src/config/env');
    aliceCookie = `orbit_sid=s%3A${encodeURIComponent(cookieSignature.sign(aliceToken, env.COOKIE_SECRET))}`;
    bobCookie = `orbit_sid=s%3A${encodeURIComponent(cookieSignature.sign(bobToken, env.COOKIE_SECRET))}`;

    // Setup Mock DB
    db.withTransaction = async (callback) => {
      const mockClient = {
        query: async (text, params) => {
          const sql = text.replace(/\s+/g, ' ').trim();

          if (sql.includes('INSERT INTO tasks')) {
            const newTask = {
              id: 'f1111111-1111-4111-8111-111111111111',
              project_id: params[0],
              created_by: params[1],
              title: params[2],
              description: params[3],
              status: 'todo',
              priority: params[4],
              due_date: params[5],
              position: params[6],
              is_archived: false,
              created_at: new Date(),
              updated_at: new Date(),
            };
            tasksStore.push(newTask);
            return { rows: [newTask] };
          }

          if (sql.includes('INSERT INTO task_assignees')) {
            assigneesStore.push({
              task_id: params[0],
              user_id: params[1],
              project_id: params[2],
            });
            return { rowCount: 1 };
          }

          if (sql.includes('DELETE FROM task_assignees WHERE task_id = $1 AND project_id = $2')) {
            assigneesStore = assigneesStore.filter(
              (a) => !(a.task_id === params[0] && a.project_id === params[1])
            );
            return { rowCount: 1 };
          }

          if (sql.includes('SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = ANY($1::uuid[])')) {
            const matched = usersStore
              .filter((u) => params[0].includes(u.id))
              .map((u) => ({ id: u.id, name: u.name, email: u.email, avatarColor: u.avatar_color }));
            return { rows: matched };
          }

          if (sql.includes('SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1')) {
            const u = usersStore.find((x) => x.id === params[0]);
            return { rows: u ? [{ id: u.id, name: u.name, email: u.email, avatarColor: u.avatar_color }] : [] };
          }

          if (sql.includes('SELECT id, status, position FROM tasks WHERE id = $1 AND project_id = $2 FOR UPDATE')) {
            const t = tasksStore.find((x) => x.id === params[0] && x.project_id === params[1]);
            return { rows: t ? [t] : [] };
          }

          if (sql.includes('UPDATE tasks SET status = $1, position = $2, updated_at = NOW() WHERE id = $3 AND project_id = $4')) {
            const t = tasksStore.find((x) => x.id === params[2] && x.project_id === params[3]);
            if (t) {
              t.status = params[0];
              t.position = params[1];
              t.updated_at = new Date();
            }
            return { rowCount: 1 };
          }

          if (sql.includes('UPDATE tasks SET')) {
            const t = tasksStore.find((x) => x.id === params[params.length - 2]);
            if (t) {
              if (text.includes('title =')) t.title = params[0];
              t.updated_at = new Date();
            }
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

      // Member check
      if (sql.includes('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2')) {
        const m = membersStore.find((x) => x.project_id === params[0] && x.user_id === params[1]);
        return { rows: m ? [{ role: m.role }] : [] };
      }

      if (sql.includes('SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = ANY($2::uuid[])')) {
        const matches = membersStore
          .filter((m) => m.project_id === params[0] && params[1].includes(m.user_id))
          .map((m) => ({ user_id: m.user_id }));
        return { rows: matches };
      }

      if (sql.includes('SELECT COALESCE(MAX(position) + 1, 0)::int AS next_pos FROM tasks')) {
        const inTodo = tasksStore.filter((t) => t.project_id === params[0] && t.status === 'todo' && !t.is_archived);
        return { rows: [{ next_pos: inTodo.length }] };
      }

      if (sql.includes('SELECT id, project_id, status FROM tasks WHERE id = $1 AND project_id = $2')) {
        const t = tasksStore.find((x) => x.id === params[0] && x.project_id === params[1]);
        return { rows: t ? [t] : [] };
      }

      if (sql.includes('SELECT id, created_by, title FROM tasks WHERE id = $1 AND project_id = $2')) {
        const t = tasksStore.find((x) => x.id === params[0] && x.project_id === params[1]);
        return { rows: t ? [t] : [] };
      }

      if (sql.includes('DELETE FROM tasks WHERE id = $1 AND project_id = $2')) {
        tasksStore = tasksStore.filter((t) => !(t.id === params[0] && t.project_id === params[1]));
        assigneesStore = assigneesStore.filter((a) => a.task_id !== params[0]);
        return { rowCount: 1 };
      }

      if (sql.includes('FROM tasks t') && sql.includes('WHERE t.id = $1 AND t.project_id = $2')) {
        const t = tasksStore.find((x) => x.id === params[0] && x.project_id === params[1]);
        if (!t) return { rows: [] };
        const creator = usersStore.find((u) => u.id === t.created_by);
        const assignedUsers = assigneesStore
          .filter((a) => a.task_id === t.id)
          .map((a) => {
            const u = usersStore.find((user) => user.id === a.user_id);
            return { id: u.id, name: u.name, email: u.email, avatarColor: u.avatar_color };
          });
        return {
          rows: [
            {
              id: t.id,
              project_id: t.project_id,
              created_by: t.created_by,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              due_date: t.due_date,
              position: t.position,
              is_archived: t.is_archived,
              created_at: t.created_at,
              updated_at: t.updated_at,
              project_name: 'Website Launch',
              project_color: '#6366F1',
              creator_name: creator?.name,
              creator_email: creator?.email,
              creator_avatar_color: creator?.avatar_color,
              assignees: assignedUsers,
            },
          ],
        };
      }

      if (sql.includes('FROM tasks t') && sql.includes('WHERE t.project_id = $1 AND t.is_archived = false')) {
        const matched = tasksStore
          .filter((t) => t.project_id === params[0] && !t.is_archived)
          .map((t) => {
            const creator = usersStore.find((u) => u.id === t.created_by);
            const assignedUsers = assigneesStore
              .filter((a) => a.task_id === t.id)
              .map((a) => {
                const u = usersStore.find((user) => user.id === a.user_id);
                return { id: u.id, name: u.name, email: u.email, avatarColor: u.avatar_color };
              });
            return {
              id: t.id,
              project_id: t.project_id,
              created_by: t.created_by,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              due_date: t.due_date,
              position: t.position,
              is_archived: t.is_archived,
              created_at: t.created_at,
              updated_at: t.updated_at,
              creator_name: creator?.name,
              creator_email: creator?.email,
              creator_avatar_color: creator?.avatar_color,
              assignees: assignedUsers,
            };
          });
        return { rows: matched };
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

  it('GET /api/projects/:id/tasks requires authentication (rejects with 401)', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`);
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/projects/:id/tasks rejects request without CSRF token (403)', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
      },
      body: JSON.stringify({ title: 'New Task' }),
    });
    assert.strictEqual(res.status, 403);
  });

  it('POST /api/projects/:id/tasks creates a task and returns 201 with standard envelope', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        title: 'Design Kanban UI',
        description: 'Implement drag-and-drop board',
        priority: 'high',
        due_date: '2026-12-25',
        assignee_ids: [bobId],
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.task.title, 'Design Kanban UI');
    assert.strictEqual(body.data.task.status, 'todo');
    assert.strictEqual(body.data.task.assignees.length, 1);
    assert.strictEqual(body.data.task.assignees[0].id, bobId);

    createdTaskId = body.data.task.id;
  });

  it('GET /api/projects/:id/tasks returns grouped tasks with all four columns', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      headers: {
        'Cookie': aliceCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.todo));
    assert.ok(Array.isArray(body.data.in_progress));
    assert.ok(Array.isArray(body.data.review));
    assert.ok(Array.isArray(body.data.done));
    assert.strictEqual(body.data.todo.length, 1);
    assert.strictEqual(body.data.todo[0].title, 'Design Kanban UI');
  });

  it('GET /api/projects/:id/tasks/:taskId returns task detail with creator & assignees', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${createdTaskId}`, {
      headers: {
        'Cookie': aliceCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.task.title, 'Design Kanban UI');
    assert.strictEqual(body.data.task.projectName, 'Website Launch');
  });

  it('PATCH /api/projects/:id/tasks/:taskId updates task details', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        title: 'Design Kanban Board & Flow',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.task.title, 'Design Kanban Board & Flow');
  });

  it('PATCH /api/projects/:id/tasks/:taskId/move moves task to new status & position', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${createdTaskId}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        status: 'in_progress',
        position: 0,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.task.status, 'in_progress');
    assert.strictEqual(body.data.task.position, 0);
  });

  it('DELETE /api/projects/:id/tasks/:taskId deletes task and returns 200 standard envelope', async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${createdTaskId}`, {
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
