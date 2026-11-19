'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const commentService = require('../../src/services/commentService');
const db = require('../../src/config/db');

describe('Comment Service Business Logic Unit Tests (Phase 5)', () => {
  const projectId = 'd1111111-1111-4111-8111-111111111111';
  const taskId = 'f1111111-1111-4111-8111-111111111111';
  const otherTaskId = 'f2222222-2222-4222-8222-222222222222';

  const ownerId = 'a1111111-1111-4111-8111-111111111111';
  const adminId = 'b2222222-2222-4222-8222-222222222222';
  const memberId = 'c3333333-3333-4333-8333-333333333333';
  const otherMemberId = 'c4444444-4444-4444-8444-444444444444';
  const outsiderId = 'e5555555-5555-4555-8555-555555555555';

  let usersStore = [];
  let membersStore = [];
  let tasksStore = [];
  let commentsStore = [];

  beforeEach(() => {
    usersStore = [
      { id: ownerId, name: 'Alice Owner', email: 'alice@example.com', avatar_color: '#5B5BD6' },
      { id: adminId, name: 'Bob Admin', email: 'bob@example.com', avatar_color: '#22C55E' },
      { id: memberId, name: 'Charlie Member', email: 'charlie@example.com', avatar_color: '#F59E0B' },
      { id: otherMemberId, name: 'Dave Member', email: 'dave@example.com', avatar_color: '#8B5CF6' },
      { id: outsiderId, name: 'Eve Outsider', email: 'eve@example.com', avatar_color: '#EF4444' },
    ];

    membersStore = [
      { project_id: projectId, user_id: ownerId, role: 'owner' },
      { project_id: projectId, user_id: adminId, role: 'admin' },
      { project_id: projectId, user_id: memberId, role: 'member' },
      { project_id: projectId, user_id: otherMemberId, role: 'member' },
    ];

    tasksStore = [
      { id: taskId, project_id: projectId, title: 'Main Task' },
      { id: otherTaskId, project_id: 'd9999999-9999-4999-8999-999999999999', title: 'Other Project Task' },
    ];

    commentsStore = [];

    // Mock db.query
    db.query = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();

      // Project membership check
      if (sql.includes('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2')) {
        const found = membersStore.find(
          (m) => m.project_id === params[0] && m.user_id === params[1]
        );
        return { rows: found ? [{ role: found.role }] : [] };
      }

      // Task in project check
      if (sql.includes('SELECT id, project_id, title FROM tasks WHERE id = $1 AND project_id = $2')) {
        const found = tasksStore.find(
          (t) => t.id === params[0] && t.project_id === params[1]
        );
        return { rows: found ? [found] : [] };
      }

      // List comments query
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
          id: 'c0000000-0000-4000-8000-00000000000' + (commentsStore.length + 1),
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

      // Author lookup
      if (sql.includes('SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1')) {
        const user = usersStore.find((u) => u.id === params[0]);
        if (!user) return { rows: [] };
        return {
          rows: [
            {
              id: user.id,
              name: user.name,
              email: user.email,
              avatarColor: user.avatar_color,
            },
          ],
        };
      }

      // Check comment exists
      if (sql.includes('SELECT id, task_id, author_id FROM task_comments WHERE id = $1 AND task_id = $2')) {
        const found = commentsStore.find(
          (c) => c.id === params[0] && c.task_id === params[1]
        );
        return { rows: found ? [found] : [] };
      }

      // Update comment
      if (sql.includes('UPDATE task_comments')) {
        const comment = commentsStore.find(
          (c) => c.id === params[1] && c.task_id === params[2]
        );
        if (comment) {
          comment.body = params[0];
          comment.is_edited = true;
          comment.updated_at = new Date();
          return { rows: [comment] };
        }
        return { rows: [] };
      }

      // Delete comment
      if (sql.includes('DELETE FROM task_comments WHERE id = $1 AND task_id = $2')) {
        const initialLen = commentsStore.length;
        commentsStore = commentsStore.filter(
          (c) => !(c.id === params[0] && c.task_id === params[1])
        );
        return { rowCount: initialLen - commentsStore.length };
      }

      throw new Error(`Unhandled SQL query in mock: ${sql}`);
    };
  });

  describe('getTaskComments', () => {
    it('returns empty array when task has no comments', async () => {
      const comments = await commentService.getTaskComments(projectId, taskId, memberId);
      assert.deepStrictEqual(comments, []);
    });

    it('returns comments in chronological order with author details', async () => {
      await commentService.createComment(projectId, taskId, memberId, { body: 'First comment' });
      await commentService.createComment(projectId, taskId, adminId, { body: 'Second comment' });

      const comments = await commentService.getTaskComments(projectId, taskId, memberId);
      assert.strictEqual(comments.length, 2);
      assert.strictEqual(comments[0].body, 'First comment');
      assert.strictEqual(comments[0].author.name, 'Charlie Member');
      assert.strictEqual(comments[1].body, 'Second comment');
      assert.strictEqual(comments[1].author.name, 'Bob Admin');
    });

    it('rejects non-project-member with 403', async () => {
      await assert.rejects(
        commentService.getTaskComments(projectId, taskId, outsiderId),
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'NOT_A_MEMBER');
          return true;
        }
      );
    });

    it('rejects when task does not belong to the project with 404', async () => {
      await assert.rejects(
        commentService.getTaskComments(projectId, otherTaskId, memberId),
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.strictEqual(err.code, 'TASK_NOT_FOUND');
          return true;
        }
      );
    });
  });

  describe('createComment', () => {
    it('creates a comment and associates author correctly', async () => {
      const comment = await commentService.createComment(projectId, taskId, memberId, {
        body: 'Initial proposal feedback.',
      });

      assert.ok(comment.id);
      assert.strictEqual(comment.body, 'Initial proposal feedback.');
      assert.strictEqual(comment.isEdited, false);
      assert.strictEqual(comment.author.id, memberId);
      assert.strictEqual(comment.author.name, 'Charlie Member');
    });

    it('trims leading and trailing whitespace on comment body', async () => {
      const comment = await commentService.createComment(projectId, taskId, memberId, {
        body: '   Trimmed message   ',
      });
      assert.strictEqual(comment.body, 'Trimmed message');
    });

    it('rejects non-project-member with 403', async () => {
      await assert.rejects(
        commentService.createComment(projectId, taskId, outsiderId, { body: 'Hello' }),
        (err) => {
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });
  });

  describe('updateComment', () => {
    it('allows author to update comment body and sets isEdited to true', async () => {
      const created = await commentService.createComment(projectId, taskId, memberId, {
        body: 'Original text',
      });

      const updated = await commentService.updateComment(projectId, taskId, created.id, memberId, {
        body: 'Edited text',
      });

      assert.strictEqual(updated.body, 'Edited text');
      assert.strictEqual(updated.isEdited, true);
    });

    it('forbids other project members (even admin/owner) from editing someone else’s comment', async () => {
      const created = await commentService.createComment(projectId, taskId, memberId, {
        body: 'Charlie comment',
      });

      await assert.rejects(
        commentService.updateComment(projectId, taskId, created.id, adminId, {
          body: 'Admin trying to change Charlie words',
        }),
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          return true;
        }
      );

      await assert.rejects(
        commentService.updateComment(projectId, taskId, created.id, ownerId, {
          body: 'Owner trying to change Charlie words',
        }),
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    it('rejects non-existent comment with 404', async () => {
      await assert.rejects(
        commentService.updateComment(
          projectId,
          taskId,
          'c9999999-9999-4999-8999-999999999999',
          memberId,
          { body: 'Does not exist' }
        ),
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.strictEqual(err.code, 'COMMENT_NOT_FOUND');
          return true;
        }
      );
    });
  });

  describe('deleteComment', () => {
    it('allows comment author to delete their own comment', async () => {
      const created = await commentService.createComment(projectId, taskId, memberId, {
        body: 'Charlie self-delete',
      });

      const result = await commentService.deleteComment(projectId, taskId, created.id, memberId);
      assert.strictEqual(result.deleted, true);

      const comments = await commentService.getTaskComments(projectId, taskId, memberId);
      assert.strictEqual(comments.length, 0);
    });

    it('allows project owner to moderate (delete) any comment', async () => {
      const created = await commentService.createComment(projectId, taskId, memberId, {
        body: 'Inappropriate remark',
      });

      const result = await commentService.deleteComment(projectId, taskId, created.id, ownerId);
      assert.strictEqual(result.deleted, true);
    });

    it('allows project admin to moderate (delete) any comment', async () => {
      const created = await commentService.createComment(projectId, taskId, memberId, {
        body: 'Admin moderation target',
      });

      const result = await commentService.deleteComment(projectId, taskId, created.id, adminId);
      assert.strictEqual(result.deleted, true);
    });

    it('rejects regular members who are not the author with 403', async () => {
      const created = await commentService.createComment(projectId, taskId, memberId, {
        body: 'Charlie remark',
      });

      await assert.rejects(
        commentService.deleteComment(projectId, taskId, created.id, otherMemberId),
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    it('rejects deleting non-existent comment with 404', async () => {
      await assert.rejects(
        commentService.deleteComment(
          projectId,
          taskId,
          'c9999999-9999-4999-8999-999999999999',
          memberId
        ),
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.strictEqual(err.code, 'COMMENT_NOT_FOUND');
          return true;
        }
      );
    });
  });
});
