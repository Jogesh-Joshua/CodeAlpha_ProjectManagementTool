'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const memberService = require('../../src/services/memberService');
const db = require('../../src/config/db');

describe('Member Service Business Logic Unit Tests (Phase 3)', () => {
  let projectsStore = [];
  let membersStore = [];
  let usersStore = [];

  const ownerId = 'u-11111111-1111-4111-8111-111111111111';
  const adminId = 'u-22222222-2222-4222-8222-222222222222';
  const memberId = 'u-33333333-3333-4333-8333-333333333333';
  const outsiderId = 'u-44444444-4444-4444-8444-444444444444';
  const projectId = 'p-10000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    usersStore = [
      { id: ownerId, name: 'Alice Owner', email: 'alice@example.com', avatar_color: '#5B5BD6' },
      { id: adminId, name: 'Bob Admin', email: 'bob@example.com', avatar_color: '#22C55E' },
      { id: memberId, name: 'Charlie Member', email: 'charlie@example.com', avatar_color: '#F59E0B' },
      { id: outsiderId, name: 'Diana New', email: 'diana@example.com', avatar_color: '#EF4444' },
    ];

    projectsStore = [
      { id: projectId, name: 'Alpha Project', owner_id: ownerId },
    ];

    membersStore = [
      { project_id: projectId, user_id: ownerId, role: 'owner', joined_at: new Date('2026-01-01') },
      { project_id: projectId, user_id: adminId, role: 'admin', joined_at: new Date('2026-01-02') },
      { project_id: projectId, user_id: memberId, role: 'member', joined_at: new Date('2026-01-03') },
    ];

    // Mock db.withTransaction
    db.withTransaction = async (callback) => {
      const mockClient = {
        query: async (text, params) => {
          const sql = text.replace(/\s+/g, ' ').trim();

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

    // Mock db.query
    db.query = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();

      if (sql.includes('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2')) {
        const m = membersStore.find((x) => x.project_id === params[0] && x.user_id === params[1]);
        return { rows: m ? [{ role: m.role }] : [] };
      }

      if (sql.includes('FROM project_members pm') && sql.includes('INNER JOIN users u ON u.id = pm.user_id') && sql.includes('pm.project_id = $1 AND pm.user_id = $2')) {
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

      if (sql.includes('FROM project_members pm') && sql.includes('INNER JOIN users u ON u.id = pm.user_id') && sql.includes('WHERE pm.project_id = $1')) {
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

      if (sql.includes('SELECT id, name, email, avatar_color FROM users WHERE LOWER(email) = $1')) {
        const u = usersStore.find((user) => user.email.toLowerCase() === params[0].toLowerCase());
        return { rows: u ? [u] : [] };
      }

      if (sql.includes('INSERT INTO project_members (project_id, user_id, role)')) {
        const newMember = {
          project_id: params[0],
          user_id: params[1],
          role: params[2],
          joined_at: new Date(),
        };
        membersStore.push(newMember);
        return { rows: [{ role: newMember.role, joined_at: newMember.joined_at }] };
      }

      if (sql.includes('UPDATE project_members') && sql.includes('SET role = $1')) {
        const m = membersStore.find((x) => x.project_id === params[1] && x.user_id === params[2]);
        if (m) m.role = params[0];
        return { rows: [{ role: m.role }] };
      }

      if (sql.includes('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2')) {
        membersStore = membersStore.filter(
          (m) => !(m.project_id === params[0] && m.user_id === params[1])
        );
        return { rowCount: 1 };
      }

      return { rows: [] };
    };
  });

  it('getProjectMembers lists all members for a project', async () => {
    const list = await memberService.getProjectMembers(projectId, ownerId);
    assert.strictEqual(list.length, 3);
    assert.strictEqual(list[0].role, 'owner');
    assert.strictEqual(list[1].role, 'admin');
  });

  it('addMemberByEmail successfully adds registered user as member', async () => {
    const added = await memberService.addMemberByEmail(
      projectId,
      ownerId,
      'diana@example.com',
      'member'
    );

    assert.strictEqual(added.email, 'diana@example.com');
    assert.strictEqual(added.role, 'member');
    assert.strictEqual(membersStore.length, 4);
  });

  it('addMemberByEmail rejects unregistered user with 404', async () => {
    await assert.rejects(
      async () => {
        await memberService.addMemberByEmail(projectId, ownerId, 'nonexistent@example.com');
      },
      (err) => {
        assert.strictEqual(err.code, 'USER_NOT_FOUND');
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  });

  it('addMemberByEmail rejects user already in project with 409', async () => {
    await assert.rejects(
      async () => {
        await memberService.addMemberByEmail(projectId, ownerId, 'bob@example.com');
      },
      (err) => {
        assert.strictEqual(err.code, 'ALREADY_MEMBER');
        assert.strictEqual(err.status, 409);
        return true;
      }
    );
  });

  it('addMemberByEmail disallows adding member as owner directly', async () => {
    await assert.rejects(
      async () => {
        await memberService.addMemberByEmail(projectId, ownerId, 'diana@example.com', 'owner');
      },
      (err) => {
        assert.strictEqual(err.code, 'CANNOT_ASSIGN_OWNER_ROLE');
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  it('updateMemberRole allows owner to promote member to admin', async () => {
    const updated = await memberService.updateMemberRole(projectId, ownerId, memberId, 'admin');
    assert.strictEqual(updated.role, 'admin');
  });

  it('updateMemberRole executes atomic ownership transfer when role is owner', async () => {
    const transfer = await memberService.updateMemberRole(projectId, ownerId, adminId, 'owner');
    assert.strictEqual(transfer.role, 'owner');
    assert.strictEqual(transfer.ownershipTransferred, true);

    // Old owner demoted to admin
    const oldOwner = membersStore.find((m) => m.user_id === ownerId);
    assert.strictEqual(oldOwner.role, 'admin');

    // New owner promoted to owner
    const newOwner = membersStore.find((m) => m.user_id === adminId);
    assert.strictEqual(newOwner.role, 'owner');
  });

  it('removeMember prevents removing the project owner', async () => {
    await assert.rejects(
      async () => {
        await memberService.removeMember(projectId, adminId, ownerId);
      },
      (err) => {
        assert.strictEqual(err.code, 'CANNOT_REMOVE_OWNER');
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  it('removeMember prevents admin from removing other admins', async () => {
    // Add another admin
    membersStore.push({ project_id: projectId, user_id: outsiderId, role: 'admin', joined_at: new Date() });

    await assert.rejects(
      async () => {
        await memberService.removeMember(projectId, adminId, outsiderId);
      },
      (err) => {
        assert.strictEqual(err.code, 'INSUFFICIENT_ROLE');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });

  it('removeMember allows owner to remove a member', async () => {
    const result = await memberService.removeMember(projectId, ownerId, memberId);
    assert.strictEqual(result.removed, true);
    assert.strictEqual(membersStore.some((m) => m.user_id === memberId), false);
  });
});
