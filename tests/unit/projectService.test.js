'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const projectService = require('../../src/services/projectService');
const db = require('../../src/config/db');

describe('Project Service Business Logic Unit Tests (Phase 3)', () => {
  let projectsStore = [];
  let membersStore = [];
  let usersStore = [];

  const ownerId = 'a1111111-1111-4111-8111-111111111111';
  const otherUserId = 'b2222222-2222-4222-8222-222222222222';
  const defaultProjectId = 'e1000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    projectsStore = [];
    membersStore = [];
    usersStore = [
      {
        id: ownerId,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        avatar_color: '#5B5BD6',
      },
      {
        id: otherUserId,
        name: 'Bob Smith',
        email: 'bob@example.com',
        avatar_color: '#22C55E',
      },
    ];

    // Mock db.withTransaction
    db.withTransaction = async (callback) => {
      const mockClient = {
        query: async (text, params) => {
          const sql = text.replace(/\s+/g, ' ').trim();

          if (sql.includes('INSERT INTO projects')) {
            const newProject = {
              id: defaultProjectId,
              name: params[0],
              description: params[1],
              color: params[2],
              owner_id: params[3],
              is_archived: false,
              created_at: new Date(),
              updated_at: new Date(),
            };
            projectsStore.push(newProject);
            return { rows: [newProject] };
          }

          if (sql.includes('INSERT INTO project_members')) {
            const newMember = {
              project_id: params[0],
              user_id: params[1],
              role: params[2] || 'owner',
              joined_at: new Date(),
            };
            membersStore.push(newMember);
            return { rows: [newMember] };
          }

          if (sql.includes('SELECT id, name, email, avatar_color FROM users WHERE id = $1')) {
            const user = usersStore.find((u) => u.id === params[0]);
            return { rows: user ? [user] : [] };
          }

          return { rows: [] };
        },
      };
      return callback(mockClient);
    };

    // Mock db.query
    db.query = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();

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

      if (sql.includes('FROM project_members pm') && sql.includes('INNER JOIN users u ON u.id = pm.user_id')) {
        const members = membersStore
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
        return { rows: members };
      }

      if (sql.includes('UPDATE projects') && sql.includes('SET')) {
        const p = projectsStore.find((proj) => proj.id === params[params.length - 1]);
        if (!p) return { rows: [] };
        if (params.length >= 2) p.name = params[0];
        p.updated_at = new Date();
        return { rows: [p] };
      }

      if (sql.includes('SELECT id, name, owner_id FROM projects WHERE id = $1')) {
        const p = projectsStore.find((proj) => proj.id === params[0]);
        return { rows: p ? [p] : [] };
      }

      if (sql.includes('DELETE FROM projects WHERE id = $1')) {
        projectsStore = projectsStore.filter((proj) => proj.id !== params[0]);
        membersStore = membersStore.filter((m) => m.project_id !== params[0]);
        return { rowCount: 1 };
      }

      return { rows: [] };
    };
  });

  it('createProject creates project and assigns creator as owner in transaction', async () => {
    const project = await projectService.createProject({
      name: 'Orbit Redesign',
      description: 'New sleek interface',
      color: '#6366F1',
      ownerId,
    });

    assert.ok(project.id);
    assert.strictEqual(project.name, 'Orbit Redesign');
    assert.strictEqual(project.userRole, 'owner');
    assert.strictEqual(project.memberCount, 1);
    assert.strictEqual(project.owner.id, ownerId);
    assert.strictEqual(membersStore.length, 1);
    assert.strictEqual(membersStore[0].role, 'owner');
  });

  it('getUserProjects lists projects where user is a member', async () => {
    await projectService.createProject({
      name: 'Project 1',
      ownerId,
    });

    const list = await projectService.getUserProjects(ownerId);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, 'Project 1');
    assert.strictEqual(list[0].userRole, 'owner');
  });

  it('getProjectById retrieves project when caller is a member and rejects non-member', async () => {
    const created = await projectService.createProject({
      name: 'Confidential Workspace',
      ownerId,
    });

    // Allowed for owner
    const details = await projectService.getProjectById(created.id, ownerId);
    assert.strictEqual(details.name, 'Confidential Workspace');
    assert.strictEqual(details.userRole, 'owner');

    // Forbidden for non-member (403)
    await assert.rejects(
      async () => {
        await projectService.getProjectById(created.id, otherUserId);
      },
      (err) => {
        assert.strictEqual(err.code, 'NOT_A_MEMBER');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });

  it('updateProject allows owner or admin and updates project details', async () => {
    const created = await projectService.createProject({
      name: 'Initial Name',
      ownerId,
    });

    const updated = await projectService.updateProject(created.id, ownerId, {
      name: 'Updated Name',
    });

    assert.strictEqual(updated.name, 'Updated Name');
  });

  it('deleteProject allows owner and rejects non-owner with 403', async () => {
    const created = await projectService.createProject({
      name: 'Project to Delete',
      ownerId,
    });

    // Non-owner cannot delete
    await assert.rejects(
      async () => {
        await projectService.deleteProject(created.id, otherUserId);
      },
      (err) => {
        assert.strictEqual(err.code, 'FORBIDDEN_NOT_OWNER');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    // Owner can delete
    const result = await projectService.deleteProject(created.id, ownerId);
    assert.strictEqual(result.deleted, true);
    assert.strictEqual(projectsStore.length, 0);
  });
});
