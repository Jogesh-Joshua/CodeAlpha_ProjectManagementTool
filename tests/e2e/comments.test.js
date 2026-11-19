'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../../src/app');
const db = require('../../src/config/db');

describe('E2E Task Comments & Communication API Tests (Phase 5)', () => {
  let server;
  let baseUrl;

  const projectId = 'd1111111-1111-4111-8111-111111111111';
  const otherProjectId = 'd9999999-9999-4999-8999-999999999999';
  const taskId = 'f1111111-1111-4111-8111-111111111111';
  const otherTaskId = 'f2222222-2222-4222-8222-222222222222';

  const aliceId = 'a1111111-1111-4111-8111-111111111111'; // Owner
  const bobId = 'b2222222-2222-4222-8222-222222222222';   // Member
  const charlieId = 'c3333333-3333-4333-8333-333333333333'; // Another Member
  const outsiderId = 'e5555555-5555-4555-8555-555555555555'; // Outsider

  let aliceCookie = '';
  let aliceCsrf = '';
  let bobCookie = '';
  let bobCsrf = '';
  let charlieCookie = '';
  let charlieCsrf = '';
  let outsiderCookie = '';
  let outsiderCsrf = '';

  let usersStore = [];
  let sessionsStore = [];
  let membersStore = [];
  let tasksStore = [];
  let commentsStore = [];

  let createdCommentId = '';

  before(async () => {
    usersStore = [
      { id: aliceId, name: 'Alice Owner', email: 'alice@example.com', avatar_color: '#5B5BD6' },
      { id: bobId, name: 'Bob Member', email: 'bob@example.com', avatar_color: '#22C55E' },
      { id: charlieId, name: 'Charlie Member', email: 'charlie@example.com', avatar_color: '#F59E0B' },
      { id: outsiderId, name: 'Eve Outsider', email: 'eve@example.com', avatar_color: '#EF4444' },
    ];

    membersStore = [
      { project_id: projectId, user_id: aliceId, role: 'owner' },
      { project_id: projectId, user_id: bobId, role: 'member' },
      { project_id: projectId, user_id: charlieId, role: 'member' },
    ];

    tasksStore = [
      { id: taskId, project_id: projectId, title: 'Release Pipeline Setup' },
      { id: otherTaskId, project_id: otherProjectId, title: 'Foreign Task' },
    ];

    commentsStore = [];

    // Seed sessions
    const { hashSessionToken } = require('../../src/utils/crypto');
    const cookieSignature = require('cookie-signature');
    const env = require('../../src/config/env');

    const makeUserSession = (userId, rawToken, rawCsrf) => {
      sessionsStore.push({
        id: hashSessionToken(rawToken),
        user_id: userId,
        data: { csrfToken: rawCsrf },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      return {
        cookie: `orbit_sid=s%3A${encodeURIComponent(cookieSignature.sign(rawToken, env.COOKIE_SECRET))}`,
        csrf: rawCsrf,
      };
    };

    const aliceSess = makeUserSession(aliceId, 'alice_token_phase5_1234567890abcdef1234567890abcdef', 'alice_csrf_phase5_1234567890abcdef1234567890abcdef');
    aliceCookie = aliceSess.cookie;
    aliceCsrf = aliceSess.csrf;

    const bobSess = makeUserSession(bobId, 'bob_token_phase5_1234567890abcdef1234567890abcdef', 'bob_csrf_phase5_1234567890abcdef1234567890abcdef');
    bobCookie = bobSess.cookie;
    bobCsrf = bobSess.csrf;

    const charlieSess = makeUserSession(charlieId, 'charlie_token_phase5_1234567890abcdef1234567890abcdef', 'charlie_csrf_phase5_1234567890abcdef1234567890abcdef');
    charlieCookie = charlieSess.cookie;
    charlieCsrf = charlieSess.csrf;

    const outsiderSess = makeUserSession(outsiderId, 'outsider_token_phase5_1234567890abcdef1234567890abcdef', 'outsider_csrf_phase5_1234567890abcdef1234567890abcdef');
    outsiderCookie = outsiderSess.cookie;
    outsiderCsrf = outsiderSess.csrf;

    // Mock DB queries
    db.query = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();

      // Auth middleware lookup
      if (sql.includes('FROM sessions s') && sql.includes('JOIN users u')) {
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

      // Task in project check
      if (sql.includes('SELECT id, project_id, title FROM tasks WHERE id = $1 AND project_id = $2')) {
        const t = tasksStore.find((x) => x.id === params[0] && x.project_id === params[1]);
        return { rows: t ? [t] : [] };
      }

      // List comments
      if (sql.includes('FROM task_comments c') && sql.includes('ORDER BY c.created_at ASC')) {
        const matching = commentsStore
          .filter((c) => c.task_id === params[0])
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .map((c) => {
            const author = usersStore.find((u) => u.id === c.author_id) || {};
            return {
              id: c.id,
              task_id: c.task_id,
              author_id: c.author_id,
              body: c.body,
              is_edited: c.is_edited,
              created_at: c.created_at,
              updated_at: c.updated_at,
              author_name: author.name,
              author_email: author.email,
              author_avatar_color: author.avatar_color,
            };
          });
        return { rows: matching };
      }

      // Insert comment
      if (sql.includes('INSERT INTO task_comments')) {
        const newComment = {
          id: 'c1111111-1111-4111-8111-00000000000' + (commentsStore.length + 1),
          task_id: params[0],
          author_id: params[1],
          body: params[2],
          is_edited: false,
          created_at: new Date(),
          updated_at: new Date(),
        };
        commentsStore.push(newComment);
        return { rows: [newComment] };
      }

      // User lookup for author
      if (sql.includes('SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1')) {
        const u = usersStore.find((user) => user.id === params[0]);
        return { rows: u ? [{ id: u.id, name: u.name, email: u.email, avatarColor: u.avatar_color }] : [] };
      }

      // Comment existence check
      if (sql.includes('SELECT id, task_id, author_id FROM task_comments WHERE id = $1 AND task_id = $2')) {
        const c = commentsStore.find((item) => item.id === params[0] && item.task_id === params[1]);
        return { rows: c ? [c] : [] };
      }

      // Update comment
      if (sql.includes('UPDATE task_comments')) {
        const c = commentsStore.find((item) => item.id === params[1] && item.task_id === params[2]);
        if (c) {
          c.body = params[0];
          c.is_edited = true;
          c.updated_at = new Date();
          return { rows: [c] };
        }
        return { rows: [] };
      }

      // Delete comment
      if (sql.includes('DELETE FROM task_comments WHERE id = $1 AND task_id = $2')) {
        commentsStore = commentsStore.filter((item) => !(item.id === params[0] && item.task_id === params[1]));
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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Authentication & Authorization Guards', () => {
    it('GET /comments rejects unauthenticated requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'NOT_AUTHENTICATED');
    });

    it('GET /comments rejects non-project-member with 403', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        headers: { Cookie: outsiderCookie },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'NOT_A_MEMBER');
    });

    it('POST /comments rejects request without CSRF token with 403', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bobCookie,
        },
        body: JSON.stringify({ body: 'Hello world' }),
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'CSRF_TOKEN_MISSING');
    });

    it('POST /comments rejects task belonging to another project with 404', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${otherTaskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bobCookie,
          'X-CSRF-Token': bobCsrf,
        },
        body: JSON.stringify({ body: 'Attempting cross-project comment' }),
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'TASK_NOT_FOUND');
    });
  });

  describe('Comment CRUD Operations', () => {
    it('POST /comments rejects empty body with 400', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bobCookie,
          'X-CSRF-Token': bobCsrf,
        },
        body: JSON.stringify({ body: '   ' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'VALIDATION_ERROR');
    });

    it('POST /comments creates comment successfully (201)', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bobCookie,
          'X-CSRF-Token': bobCsrf,
        },
        body: JSON.stringify({ body: 'Looking into this task today.' }),
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.comment.id);
      assert.strictEqual(data.data.comment.body, 'Looking into this task today.');
      assert.strictEqual(data.data.comment.author.name, 'Bob Member');
      createdCommentId = data.data.comment.id;
    });

    it('GET /comments returns list with the newly created comment (200)', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        headers: { Cookie: aliceCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.comments.length, 1);
      assert.strictEqual(data.data.comments[0].id, createdCommentId);
      assert.strictEqual(data.data.comments[0].body, 'Looking into this task today.');
    });

    it('PATCH /comments/:commentId forbids non-author from updating comment (403)', async () => {
      const res = await fetch(
        `${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments/${createdCommentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: charlieCookie,
            'X-CSRF-Token': charlieCsrf,
          },
          body: JSON.stringify({ body: 'Charlie attempting to tamper' }),
        }
      );
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    it('PATCH /comments/:commentId allows author to update comment (200)', async () => {
      const res = await fetch(
        `${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments/${createdCommentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: bobCookie,
            'X-CSRF-Token': bobCsrf,
          },
          body: JSON.stringify({ body: 'Updated: Found the bug and fixing it now.' }),
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.comment.body, 'Updated: Found the bug and fixing it now.');
      assert.strictEqual(data.data.comment.isEdited, true);
    });

    it('DELETE /comments/:commentId forbids other regular member from deleting comment (403)', async () => {
      const res = await fetch(
        `${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments/${createdCommentId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: charlieCookie,
            'X-CSRF-Token': charlieCsrf,
          },
        }
      );
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    it('DELETE /comments/:commentId allows project owner to moderate and delete comment (200)', async () => {
      const res = await fetch(
        `${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments/${createdCommentId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: aliceCookie,
            'X-CSRF-Token': aliceCsrf,
          },
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.deleted, true);

      // Verify list is now empty
      const listRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
        headers: { Cookie: bobCookie },
      });
      const listData = await listRes.json();
      assert.strictEqual(listData.data.comments.length, 0);
    });
  });
});
