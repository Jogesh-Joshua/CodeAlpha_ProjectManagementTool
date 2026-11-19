'use strict';

require('dotenv').config();
const http = require('http');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { closePool } = require('../src/config/db');

async function runLiveJourney() {
  console.log('==================================================================');
  console.log('   ORBIT — LIVE NEON DATABASE END-TO-END VERIFICATION JOURNEY     ');
  console.log('==================================================================\n');

  let server;
  let baseUrl;

  try {
    // 1. Start local server with live Neon DB connection
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    console.log(`[Setup] Local test server listening on ${baseUrl} backed by Neon DB.`);

    const timestamp = Date.now();
    const aliceEmail = `alice_${timestamp}@orbit-test.local`;
    const bobEmail = `bob_${timestamp}@orbit-test.local`;
    const outsiderEmail = `outsider_${timestamp}@orbit-test.local`;
    const password = 'SecureP@ssword123';

    let aliceCookie = '';
    let aliceCsrf = '';
    let bobCookie = '';
    let bobCsrf = '';
    let outsiderCookie = '';
    let outsiderCsrf = '';

    let projectId = '';
    let taskId = '';
    let commentId = '';
    let bobUserId = '';

    // Helper to extract cookies and CSRF from /api/auth/csrf
    async function getCsrf() {
      const res = await fetch(`${baseUrl}/api/auth/csrf`);
      const setCookie = res.headers.get('set-cookie');
      const cookie = setCookie ? setCookie.split(';')[0] : '';
      const body = await res.json();
      return { csrfToken: body.data.csrfToken, cookie };
    }

    // --- STEP 1: Register and log in Alice & Bob ---
    console.log('\n--> Step 1: Register & authenticate users (Alice and Bob)...');
    
    // Alice
    const preAlice = await getCsrf();
    const regAliceRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': preAlice.cookie,
        'X-CSRF-Token': preAlice.csrfToken,
      },
      body: JSON.stringify({
        name: 'Alice Owner',
        email: aliceEmail,
        password: password,
      }),
    });
    assert.strictEqual(regAliceRes.status, 201, 'Alice registration must return 201');
    const aliceSetCookie = regAliceRes.headers.get('set-cookie');
    aliceCookie = aliceSetCookie ? aliceSetCookie.split(';')[0] : '';
    const aliceData = await regAliceRes.json();
    aliceCsrf = aliceData.data.csrfToken;
    console.log(`  ✔ User Alice registered & session established (${aliceEmail})`);

    // Bob
    const preBob = await getCsrf();
    const regBobRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': preBob.cookie,
        'X-CSRF-Token': preBob.csrfToken,
      },
      body: JSON.stringify({
        name: 'Bob Member',
        email: bobEmail,
        password: password,
      }),
    });
    assert.strictEqual(regBobRes.status, 201, 'Bob registration must return 201');
    const bobSetCookie = regBobRes.headers.get('set-cookie');
    bobCookie = bobSetCookie ? bobSetCookie.split(';')[0] : '';
    const bobData = await regBobRes.json();
    bobCsrf = bobData.data.csrfToken;
    bobUserId = bobData.data.user.id;
    console.log(`  ✔ User Bob registered & session established (${bobEmail})`);

    // Outsider
    const preOutsider = await getCsrf();
    const regOutsiderRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': preOutsider.cookie,
        'X-CSRF-Token': preOutsider.csrfToken,
      },
      body: JSON.stringify({
        name: 'Eve Outsider',
        email: outsiderEmail,
        password: password,
      }),
    });
    assert.strictEqual(regOutsiderRes.status, 201);
    const outsiderSetCookie = regOutsiderRes.headers.get('set-cookie');
    outsiderCookie = outsiderSetCookie ? outsiderSetCookie.split(';')[0] : '';
    const outsiderData = await regOutsiderRes.json();
    outsiderCsrf = outsiderData.data.csrfToken;
    console.log(`  ✔ User Outsider registered for negative test cases`);

    // --- STEP 2: Create a project with Alice ---
    console.log('\n--> Step 2: Create a collaborative project...');
    const createProjRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        name: `Orbit Alpha Launch ${timestamp}`,
        description: 'Verify live Neon database workflow end-to-end.',
        color: '#6366F1',
      }),
    });
    assert.strictEqual(createProjRes.status, 201, 'Project creation must return 201');
    const projData = await createProjRes.json();
    projectId = projData.data.project.id;
    console.log(`  ✔ Project created successfully with ID: ${projectId}`);
    assert.strictEqual(projData.data.project.owner.id, aliceData.data.user.id);

    // --- STEP 3: Invite Bob to the project ---
    console.log('\n--> Step 3: Add Bob to project roster...');
    const addMemberRes = await fetch(`${baseUrl}/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        email: bobEmail,
        role: 'member',
      }),
    });
    assert.strictEqual(addMemberRes.status, 201, 'Adding member must return 201');
    console.log(`  ✔ Bob added to project as regular member`);

    // --- STEP 4: Verify membership and roles ---
    console.log('\n--> Step 4: Verify project membership and roles in database...');
    const membersRes = await fetch(`${baseUrl}/api/projects/${projectId}/members`, {
      headers: { 'Cookie': aliceCookie },
    });
    assert.strictEqual(membersRes.status, 200);
    const membersList = await membersRes.json();
    assert.strictEqual(membersList.data.members.length, 2, 'Project must contain exactly 2 members');
    const aliceMember = membersList.data.members.find((m) => m.email === aliceEmail);
    const bobMember = membersList.data.members.find((m) => m.email === bobEmail);
    assert.strictEqual(aliceMember.role, 'owner', 'Alice must have owner role');
    assert.strictEqual(bobMember.role, 'member', 'Bob must have member role');
    console.log(`  ✔ Verified membership: Alice=owner, Bob=member (enforced by DB owner invariant)`);

    // --- STEP 5: Create a task in 'todo' status ---
    console.log('\n--> Step 5: Create a new task...');
    const createTaskRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        title: 'Complete Neon Live Database Testing',
        description: 'Verify all 10 acceptance journey criteria on live cloud Postgres.',
        priority: 'high',
        due_date: '2026-12-31',
        assignee_ids: [],
      }),
    });
    assert.strictEqual(createTaskRes.status, 201, 'Task creation must return 201');
    const taskData = await createTaskRes.json();
    taskId = taskData.data.task.id;
    assert.strictEqual(taskData.data.task.status, 'todo');
    assert.strictEqual(taskData.data.task.position, 0);
    console.log(`  ✔ Task created with ID: ${taskId} in 'todo' column`);

    // --- STEP 6: Assign Bob to the task ---
    console.log('\n--> Step 6: Assign project member (Bob) to task...');
    const assignRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({
        assignee_ids: [bobUserId],
      }),
    });
    assert.strictEqual(assignRes.status, 200, 'Task assignment must return 200');
    const updatedTask = await assignRes.json();
    assert.strictEqual(updatedTask.data.task.assignees.length, 1);
    assert.strictEqual(updatedTask.data.task.assignees[0].email, bobEmail);
    console.log(`  ✔ Bob assigned to task; cross-table composite foreign key verified`);

    // --- STEP 7: Move task between Kanban columns ---
    console.log('\n--> Step 7: Move task across Kanban columns (todo -> in_progress -> review -> done)...');
    
    // Move to in_progress
    const moveRes1 = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': bobCookie,
        'X-CSRF-Token': bobCsrf,
      },
      body: JSON.stringify({ status: 'in_progress', position: 0 }),
    });
    assert.strictEqual(moveRes1.status, 200);

    // Move to review
    const moveRes2 = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': bobCookie,
        'X-CSRF-Token': bobCsrf,
      },
      body: JSON.stringify({ status: 'review', position: 0 }),
    });
    assert.strictEqual(moveRes2.status, 200);

    // Move to done
    const moveRes3 = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
      body: JSON.stringify({ status: 'done', position: 0 }),
    });
    assert.strictEqual(moveRes3.status, 200);
    const movedData = await moveRes3.json();
    assert.strictEqual(movedData.data.task.status, 'done');
    console.log(`  ✔ Task successfully progressed through all Kanban columns and saved in 'done'`);

    // --- STEP 8: Task comments & communication ---
    console.log('\n--> Step 8: Add, edit, and moderate task comments...');
    
    // Bob posts a comment
    const postCmtRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': bobCookie,
        'X-CSRF-Token': bobCsrf,
      },
      body: JSON.stringify({
        body: 'Working on final database validation checks.',
      }),
    });
    assert.strictEqual(postCmtRes.status, 201);
    const cmtData = await postCmtRes.json();
    commentId = cmtData.data.comment.id;
    assert.strictEqual(cmtData.data.comment.author.name, 'Bob Member');
    console.log(`  ✔ Bob posted comment: "${cmtData.data.comment.body}"`);

    // Bob edits own comment
    const editCmtRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': bobCookie,
        'X-CSRF-Token': bobCsrf,
      },
      body: JSON.stringify({
        body: 'All database validation checks verified and passing.',
      }),
    });
    assert.strictEqual(editCmtRes.status, 200);
    const editedData = await editCmtRes.json();
    assert.strictEqual(editedData.data.comment.isEdited, true);
    console.log(`  ✔ Bob edited comment: marked isEdited=true`);

    // Alice moderates (deletes) comment as project owner
    const delCmtRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
    });
    assert.strictEqual(delCmtRes.status, 200);
    console.log(`  ✔ Alice (Project Owner) successfully moderated and deleted the comment`);

    // Verify empty comments list
    const cmtListRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${taskId}/comments`, {
      headers: { 'Cookie': aliceCookie },
    });
    const cmtListData = await cmtListRes.json();
    assert.strictEqual(cmtListData.data.comments.length, 0);

    // --- STEP 9: Verify authorization restrictions ---
    console.log('\n--> Step 9: Verify authorization and boundary controls...');

    // Outsider cannot view project
    const outsiderViewRes = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      headers: { 'Cookie': outsiderCookie },
    });
    assert.strictEqual(outsiderViewRes.status, 403, 'Outsider must be rejected with 403');
    console.log(`  ✔ Non-member access to project rejected with 403 NOT_A_MEMBER`);

    // Outsider cannot create tasks
    const outsiderTaskRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': outsiderCookie,
        'X-CSRF-Token': outsiderCsrf,
      },
      body: JSON.stringify({ title: 'Hacked task' }),
    });
    assert.strictEqual(outsiderTaskRes.status, 403);
    console.log(`  ✔ Non-member task creation rejected with 403 NOT_A_MEMBER`);

    // Regular member (Bob) cannot delete the project
    const bobDelProjRes = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': bobCookie,
        'X-CSRF-Token': bobCsrf,
      },
    });
    assert.strictEqual(bobDelProjRes.status, 403, 'Regular member must not be allowed to delete project');
    console.log(`  ✔ Regular member project deletion rejected with 403 FORBIDDEN`);

    // --- STEP 10: Log out and log back in ---
    console.log('\n--> Step 10: Session lifecycle (Logout -> Check Me -> Login -> Check Me)...');

    // Logout Alice
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': aliceCookie,
        'X-CSRF-Token': aliceCsrf,
      },
    });
    assert.strictEqual(logoutRes.status, 200, 'Logout must succeed with 200');
    console.log(`  ✔ Alice logged out; session revoked in database`);

    // Verify Alice is no longer authenticated with old cookie
    const checkLoggedOutRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': aliceCookie },
    });
    assert.strictEqual(checkLoggedOutRes.status, 401, 'Revoked session must return 401');
    console.log(`  ✔ Revoked session correctly rejected with 401 NOT_AUTHENTICATED`);

    // Log Alice back in
    const preLogin = await getCsrf();
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': preLogin.cookie,
        'X-CSRF-Token': preLogin.csrfToken,
      },
      body: JSON.stringify({
        email: aliceEmail,
        password: password,
      }),
    });
    assert.strictEqual(loginRes.status, 200, 'Login must succeed with 200');
    const newAliceSetCookie = loginRes.headers.get('set-cookie');
    const newAliceCookie = newAliceSetCookie ? newAliceSetCookie.split(';')[0] : '';
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.data.user.email, aliceEmail);
    console.log(`  ✔ Alice logged back in; new session created with fresh session token`);

    // Verify /api/auth/me with new cookie
    const checkMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': newAliceCookie },
    });
    assert.strictEqual(checkMeRes.status, 200);
    const meData = await checkMeRes.json();
    assert.strictEqual(meData.data.user.name, 'Alice Owner');
    console.log(`  ✔ Verified active session for Alice: ${meData.data.user.name}`);

    console.log('\n==================================================================');
    console.log('   ALL 10 LIVE DATABASE JOURNEY STEPS VERIFIED SUCCESSFULLY!      ');
    console.log('==================================================================\n');

  } catch (err) {
    console.error('\n[Live Journey FAILED]:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }
}

runLiveJourney();
