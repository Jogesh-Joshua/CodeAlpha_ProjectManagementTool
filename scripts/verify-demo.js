'use strict';

require('dotenv').config();
const { query, closePool } = require('../src/config/db');
const commentService = require('../src/services/commentService');

async function verifyDemo() {
  console.log('=== Neon Database Demo Records Verification ===');

  const users = await query("SELECT id, name, email FROM users WHERE email LIKE '%@example.com'");
  console.log('\nDemo Users count:', users.rows.length);
  users.rows.forEach(u => console.log(` - ${u.name} <${u.email}> (${u.id})`));

  const demoUser = users.rows.find(u => u.email === 'orbit.demo@example.com');
  if (!demoUser) {
    console.error('ERROR: Demo user not found!');
    await closePool();
    process.exit(1);
  }

  const projects = await query('SELECT id, name, color, is_archived FROM projects WHERE owner_id = $1 ORDER BY created_at ASC', [demoUser.id]);
  console.log('\nDemo Projects count:', projects.rows.length);
  projects.rows.forEach(p => console.log(` - [${p.color}] ${p.name} (${p.id})`));

  const tasks = await query(`
    SELECT status, count(*)::int as count 
    FROM tasks 
    WHERE project_id IN (SELECT id FROM projects WHERE owner_id = $1) 
    GROUP BY status
    ORDER BY status
  `, [demoUser.id]);
  console.log('\nDemo Tasks by status:');
  tasks.rows.forEach(t => console.log(` - ${t.status}: ${t.count}`));

  const comments = await query(`
    SELECT count(*)::int as count 
    FROM task_comments 
    WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE owner_id = $1))
  `, [demoUser.id]);
  console.log('\nDemo Comments count:', comments.rows[0].count);

  const assignees = await query(`
    SELECT count(*)::int as count 
    FROM task_assignees 
    WHERE project_id IN (SELECT id FROM projects WHERE owner_id = $1)
  `, [demoUser.id]);
  console.log('Demo Task Assignees total entries:', assignees.rows[0].count);

  const myTasks = await query('SELECT count(*)::int as count FROM task_assignees WHERE user_id = $1', [demoUser.id]);
  console.log('Tasks specifically assigned to Alex Morgan (orbit.demo):', myTasks.rows[0].count);

  // Check sample comments on first task
  const sampleTask = await query('SELECT id, project_id, title FROM tasks WHERE project_id = $1 LIMIT 1', [projects.rows[0].id]);
  if (sampleTask.rows.length > 0) {
    const t = sampleTask.rows[0];
    const taskComments = await commentService.getTaskComments(t.project_id, t.id, demoUser.id);
    console.log(`\nSample task comments for "${t.title}": ${taskComments.length}`);
    taskComments.forEach(c => {
      console.log(`  - [${c.author.name}]: ${c.body.slice(0, 70)}...`);
    });
  }

  await closePool();
}

verifyDemo().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
