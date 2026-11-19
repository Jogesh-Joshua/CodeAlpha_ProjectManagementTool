'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const taskService = require('../../src/services/taskService');
const db = require('../../src/config/db');

describe('Task Service Business Logic Unit Tests (Phase 4)', () => {
  const projectId = 'd1111111-1111-4111-8111-111111111111';
  const ownerId = 'a1111111-1111-4111-8111-111111111111';
  const adminId = 'b2222222-2222-4222-8222-222222222222';
  const memberId = 'c3333333-3333-4333-8333-333333333333';
  const outsiderId = 'e5555555-5555-4555-8555-555555555555';

  let tasksStore = [];
  let assigneesStore = [];
  let membersStore = [];
  let usersStore = [];

  beforeEach(() => {
    usersStore = [
      { id: ownerId, name: 'Alice Owner', email: 'alice@example.com', avatar_color: '#5B5BD6' },
      { id: adminId, name: 'Bob Admin', email: 'bob@example.com', avatar_color: '#22C55E' },
      { id: memberId, name: 'Charlie Member', email: 'charlie@example.com', avatar_color: '#F59E0B' },
      { id: outsiderId, name: 'Diana Outsider', email: 'diana@example.com', avatar_color: '#EF4444' },
    ];

    membersStore = [
      { project_id: projectId, user_id: ownerId, role: 'owner' },
      { project_id: projectId, user_id: adminId, role: 'admin' },
      { project_id: projectId, user_id: memberId, role: 'member' },
    ];

    tasksStore = [];
    assigneesStore = [];

    // Mock db.withTransaction
    db.withTransaction = async (callback) => {
      const mockClient = {
        query: async (text, params) => {
          const sql = text.replace(/\s+/g, ' ').trim();

          if (sql.includes('INSERT INTO tasks')) {
            const newTask = {
              id: 't0000000-0000-4000-8000-00000000000' + (tasksStore.length + 1),
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
            // Generic update mock
            const taskId = params[params.length - 2];
            const pId = params[params.length - 1];
            const t = tasksStore.find((x) => x.id === taskId && x.project_id === pId);
            if (t) {
              if (params.length > 2 && text.includes('title =')) t.title = params[0];
              t.updated_at = new Date();
            }
            return { rowCount: 1 };
          }

          return { rows: [] };
        },
      };
      return callback(mockClient);
    };

    // Mock db.query
    db.query = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();

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
              project_name: 'Test Project',
              project_color: '#5B5BD6',
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
  });

  describe('isTaskOverdue', () => {
    it('marks past due date tasks as overdue when not done and not archived', () => {
      const task = { due_date: '2020-01-01', status: 'todo', is_archived: false };
      assert.strictEqual(taskService.isTaskOverdue(task), true);
    });

    it('does not mark completed tasks as overdue even if past due date', () => {
      const task = { due_date: '2020-01-01', status: 'done', is_archived: false };
      assert.strictEqual(taskService.isTaskOverdue(task), false);
    });

    it('does not mark future due date tasks as overdue', () => {
      const task = { due_date: '2099-12-31', status: 'todo', is_archived: false };
      assert.strictEqual(taskService.isTaskOverdue(task), false);
    });

    it('does not mark tasks without due date as overdue', () => {
      const task = { due_date: null, status: 'in_progress', is_archived: false };
      assert.strictEqual(taskService.isTaskOverdue(task), false);
    });
  });

  describe('createTask', () => {
    it('creates task with default todo status and assigns project members', async () => {
      const task = await taskService.createTask(projectId, ownerId, {
        title: 'Implement Task Service',
        description: 'Build backend business logic',
        priority: 'high',
        due_date: '2026-12-15',
        assignee_ids: [ownerId, memberId],
      });

      assert.ok(task.id);
      assert.strictEqual(task.title, 'Implement Task Service');
      assert.strictEqual(task.status, 'todo');
      assert.strictEqual(task.priority, 'high');
      assert.strictEqual(task.assignees.length, 2);
      assert.strictEqual(tasksStore.length, 1);
      assert.strictEqual(assigneesStore.length, 2);
    });

    it('rejects task creation by a non-member with 403', async () => {
      await assert.rejects(
        async () => {
          await taskService.createTask(projectId, outsiderId, {
            title: 'Unauthorized Task',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'NOT_A_MEMBER');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });

    it('rejects task creation if assignee is not a project member with 400', async () => {
      await assert.rejects(
        async () => {
          await taskService.createTask(projectId, ownerId, {
            title: 'Task with Outsider',
            assignee_ids: [outsiderId],
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_ASSIGNEE');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('getProjectTasks', () => {
    it('returns all four columns for a project', async () => {
      await taskService.createTask(projectId, ownerId, {
        title: 'Task 1',
      });

      const grouped = await taskService.getProjectTasks(projectId, ownerId);
      assert.ok(Array.isArray(grouped.todo));
      assert.ok(Array.isArray(grouped.in_progress));
      assert.ok(Array.isArray(grouped.review));
      assert.ok(Array.isArray(grouped.done));
      assert.strictEqual(grouped.todo.length, 1);
      assert.strictEqual(grouped.in_progress.length, 0);
    });
  });

  describe('getTaskById', () => {
    it('retrieves single task with creator and assignees', async () => {
      const created = await taskService.createTask(projectId, ownerId, {
        title: 'Single Task',
        assignee_ids: [memberId],
      });

      const task = await taskService.getTaskById(projectId, created.id, memberId);
      assert.strictEqual(task.title, 'Single Task');
      assert.strictEqual(task.creator.id, ownerId);
      assert.strictEqual(task.assignees.length, 1);
    });

    it('rejects access from non-member with 403', async () => {
      const created = await taskService.createTask(projectId, ownerId, {
        title: 'Secret Task',
      });

      await assert.rejects(
        async () => {
          await taskService.getTaskById(projectId, created.id, outsiderId);
        },
        (err) => {
          assert.strictEqual(err.code, 'NOT_A_MEMBER');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });
  });

  describe('updateTask', () => {
    it('updates task properties and assignees', async () => {
      const created = await taskService.createTask(projectId, ownerId, {
        title: 'Initial Title',
      });

      const updated = await taskService.updateTask(projectId, created.id, ownerId, {
        title: 'Revised Title',
        priority: 'critical',
        assignee_ids: [adminId],
      });

      assert.strictEqual(updated.title, 'Revised Title');
      assert.strictEqual(updated.assignees[0].id, adminId);
    });
  });

  describe('moveTask', () => {
    it('moves task to target status and updates position', async () => {
      const created = await taskService.createTask(projectId, ownerId, {
        title: 'Card to Move',
      });

      const moved = await taskService.moveTask(projectId, created.id, ownerId, {
        status: 'in_progress',
        position: 0,
      });

      assert.strictEqual(moved.status, 'in_progress');
      assert.strictEqual(moved.position, 0);
    });
  });

  describe('deleteTask', () => {
    it('allows project owner to delete task', async () => {
      const created = await taskService.createTask(projectId, memberId, {
        title: 'Task by Member',
      });

      const result = await taskService.deleteTask(projectId, created.id, ownerId);
      assert.strictEqual(result.deleted, true);
      assert.strictEqual(tasksStore.length, 0);
    });

    it('allows project admin to delete task', async () => {
      const created = await taskService.createTask(projectId, memberId, {
        title: 'Task by Member',
      });

      const result = await taskService.deleteTask(projectId, created.id, adminId);
      assert.strictEqual(result.deleted, true);
    });

    it('allows task creator to delete own task', async () => {
      const created = await taskService.createTask(projectId, memberId, {
        title: 'My Task',
      });

      const result = await taskService.deleteTask(projectId, created.id, memberId);
      assert.strictEqual(result.deleted, true);
    });

    it('rejects deletion by unauthorized project member with 403', async () => {
      // Created by owner, regular member tries to delete
      const created = await taskService.createTask(projectId, ownerId, {
        title: 'Owner Task',
      });

      await assert.rejects(
        async () => {
          await taskService.deleteTask(projectId, created.id, memberId);
        },
        (err) => {
          assert.strictEqual(err.code, 'FORBIDDEN');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });
  });
});
