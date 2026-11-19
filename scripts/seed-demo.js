/**
 * Orbit — Public Demo Account & Multi-Project Workspace Seeding Script
 * 
 * Provisions:
 * - 1 Primary Public Demo Account (Alex Morgan: orbit.demo@example.com)
 * - 4 Realistic Sample Teammates (Sarah Chen, Daniel Wilson, Maya Patel, Ethan Brooks)
 * - 7 Complete Sample Projects
 * - 56 Realistic Sample Tasks across all 4 workflow columns (todo, in_progress, review, done)
 * - 28 Realistic Task Comments & Discussions
 * - Full Task Assignments & Varied Due Dates (Overdue, Due Today, Upcoming, Undated)
 * 
 * Usage:
 *   node scripts/seed-demo.js          # Additive & Idempotent seed
 *   node scripts/seed-demo.js --reset  # Operator reset: clean re-seed of demo workspace
 */

'use strict';

require('dotenv').config();
const { query, withTransaction, closePool } = require('../src/config/db');
const { hashPassword } = require('../src/utils/crypto');

const DEMO_CREDENTIALS = {
  email: 'orbit.demo@example.com',
  password: 'OrbitDemo!Workspace2026#Try',
};

// 5 Sample Team Identities (all in reserved example.com domain)
const SAMPLE_USERS = [
  {
    name: 'Alex Morgan',
    email: 'orbit.demo@example.com',
    password: DEMO_CREDENTIALS.password,
    avatarColor: '#5B5BD6', // Orbit Indigo
    title: 'Product Manager & Workspace Lead',
  },
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    password: 'DemoTeammate!2026#Chen',
    avatarColor: '#EC4899', // Pink
    title: 'UI/UX Designer',
  },
  {
    name: 'Daniel Wilson',
    email: 'daniel.wilson@example.com',
    password: 'DemoTeammate!2026#Wilson',
    avatarColor: '#3B82F6', // Blue
    title: 'Frontend Developer',
  },
  {
    name: 'Maya Patel',
    email: 'maya.patel@example.com',
    password: 'DemoTeammate!2026#Patel',
    avatarColor: '#10B981', // Emerald
    title: 'Backend Developer',
  },
  {
    name: 'Ethan Brooks',
    email: 'ethan.brooks@example.com',
    password: 'DemoTeammate!2026#Brooks',
    avatarColor: '#F59E0B', // Amber
    title: 'QA Engineer',
  },
];

// Helper to calculate relative ISO date strings (YYYY-MM-DD)
function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 7 Sample Projects Definition with 8 tasks each (56 tasks total)
const SAMPLE_PROJECTS = [
  {
    name: 'Orbit Website Redesign',
    description: 'Redesigning the Orbit web application to improve usability, navigation, responsiveness, and the overall user experience.',
    color: '#6366F1', // Indigo
    memberRoles: [
      { email: 'orbit.demo@example.com', role: 'owner' },
      { email: 'sarah.chen@example.com', role: 'admin' },
      { email: 'daniel.wilson@example.com', role: 'member' },
      { email: 'ethan.brooks@example.com', role: 'member' },
    ],
    tasks: [
      {
        title: 'Design new dashboard navigation & sidebar layout',
        description: 'Create high-fidelity wireframes in Figma for the collapsible left navigation sidebar and top breadcrumbs bar.',
        status: 'done',
        priority: 'high',
        dueDate: getDateOffset(-7),
        assignees: ['sarah.chen@example.com'],
        position: 1000,
        comments: [
          { author: 'sarah.chen@example.com', body: 'Wireframes are complete and posted to Figma. Focus is on 256px desktop width with responsive mobile drawer.', offsetHours: -160 },
          { author: 'orbit.demo@example.com', body: 'The layout looks exceptionally clean and modern. Approved for implementation.', offsetHours: -140 },
        ],
      },
      {
        title: 'Implement reusable CSS design tokens & theme variables',
        description: 'Standardize brand palette, surface cards, typography scales, and radius tokens in variables.css.',
        status: 'done',
        priority: 'medium',
        dueDate: getDateOffset(-5),
        assignees: ['daniel.wilson@example.com'],
        position: 2000,
        comments: [
          { author: 'daniel.wilson@example.com', body: 'CSS variables established for light SaaS styling with high-contrast slate text.', offsetHours: -120 },
        ],
      },
      {
        title: 'Implement responsive desktop & mobile workspace layout',
        description: 'Build responsive grid supporting 1440px desktop down to 390px mobile viewports without horizontal overflow.',
        status: 'in_progress',
        priority: 'high',
        dueDate: getDateOffset(1),
        assignees: ['daniel.wilson@example.com', 'orbit.demo@example.com'],
        position: 1000,
        comments: [
          { author: 'daniel.wilson@example.com', body: 'Sidebar drawer toggle is connected and working smoothly on tablet and phone viewports.', offsetHours: -18 },
          { author: 'orbit.demo@example.com', body: 'Tested on mobile; drawer transitions feel snappy. Let us double check touch targets.', offsetHours: -10 },
        ],
      },
      {
        title: 'Build dynamic welcome banner with time-based greetings',
        description: 'Integrate user session state to render personalized greetings based on the user local time.',
        status: 'in_progress',
        priority: 'low',
        dueDate: getDateOffset(2),
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Verify WCAG AA accessibility contrast ratios',
        description: 'Audit light theme card borders, badge text colors, and button hover states for compliance.',
        status: 'review',
        priority: 'medium',
        dueDate: getDateOffset(-1), // Overdue for testing
        assignees: ['ethan.brooks@example.com'],
        position: 1000,
        comments: [
          { author: 'ethan.brooks@example.com', body: 'Running automated Lighthouse and axe-core accessibility checks. Contrast ratios look compliant across all badges.', offsetHours: -6 },
        ],
      },
      {
        title: 'Design interactive project progress visualizer',
        description: 'Calculate real-time completion percentage and display a subtle gradient progress track on project cards.',
        status: 'review',
        priority: 'high',
        dueDate: getDateOffset(0), // Due Today
        assignees: ['sarah.chen@example.com', 'orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Refactor client skeleton loading shimmer states',
        description: 'Replace blank empty spaces with animated shimmer placeholders while workspace data is being fetched.',
        status: 'todo',
        priority: 'medium',
        dueDate: getDateOffset(4),
        assignees: ['daniel.wilson@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Cross-browser rendering tests (Safari, Firefox, Chrome)',
        description: 'Ensure flexbox distributions and scrollbar customizations behave identically on all modern engines.',
        status: 'todo',
        priority: 'low',
        dueDate: getDateOffset(10),
        assignees: ['ethan.brooks@example.com'],
        position: 2000,
        comments: [],
      },
    ],
  },
  {
    name: 'Mobile App Launch',
    description: 'Planning and coordinating the launch of a cross-platform mobile application.',
    color: '#3B82F6', // Blue
    memberRoles: [
      { email: 'orbit.demo@example.com', role: 'owner' },
      { email: 'maya.patel@example.com', role: 'admin' },
      { email: 'daniel.wilson@example.com', role: 'member' },
      { email: 'ethan.brooks@example.com', role: 'member' },
    ],
    tasks: [
      {
        title: 'Finalize mobile onboarding & sign-in architecture',
        description: 'Design frictionless authentication screens with biometric credentials and session persistence.',
        status: 'done',
        priority: 'critical',
        dueDate: getDateOffset(-8),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [
          { author: 'orbit.demo@example.com', body: 'Onboarding flow finalized: 3 brief feature highlights followed by one-click demo login.', offsetHours: -180 },
        ],
      },
      {
        title: 'Implement token refresh & mobile API interceptors',
        description: 'Ensure transparent credential refresh on mobile HTTP requests when auth cookies are refreshed.',
        status: 'done',
        priority: 'high',
        dueDate: getDateOffset(-4),
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Build push notification preferences settings view',
        description: 'Allow users to toggle immediate mobile alerts for task assignments and comment mentions.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: getDateOffset(3),
        assignees: ['daniel.wilson@example.com'],
        position: 1000,
        comments: [
          { author: 'daniel.wilson@example.com', body: 'UI toggles hooked into the user profile endpoints.', offsetHours: -24 },
        ],
      },
      {
        title: 'Implement offline task cache with optimistic sync',
        description: 'Store active Kanban column states in local cache to allow smooth interactions during flaky connections.',
        status: 'in_progress',
        priority: 'high',
        dueDate: getDateOffset(5),
        assignees: ['maya.patel@example.com', 'orbit.demo@example.com'],
        position: 2000,
        comments: [
          { author: 'maya.patel@example.com', body: 'Designing conflict resolution strategy: last-write-wins with server timestamp checks.', offsetHours: -12 },
        ],
      },
      {
        title: 'Audit mobile device compatibility on iOS & Android',
        description: 'Perform layout and touch gesture validations on small-screen devices (360px width).',
        status: 'review',
        priority: 'critical',
        dueDate: getDateOffset(-2), // Overdue
        assignees: ['ethan.brooks@example.com'],
        position: 1000,
        comments: [
          { author: 'ethan.brooks@example.com', body: 'iPhone 13 and Pixel 7 viewports verified. Board horizontal scroll performs smoothly.', offsetHours: -36 },
        ],
      },
      {
        title: 'Fix mobile card swipe gestures & drag drop boundary',
        description: 'Address edge case where vertical page scrolling interfered with column dragging on touch devices.',
        status: 'review',
        priority: 'high',
        dueDate: getDateOffset(0), // Due Today
        assignees: ['daniel.wilson@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Prepare App Store & Google Play metadata & screenshots',
        description: 'Compile localized store descriptions, feature lists, privacy policy disclosures, and hero screenshots.',
        status: 'todo',
        priority: 'medium',
        dueDate: getDateOffset(14),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Coordinate beta release deployment via TestFlight',
        description: 'Distribute internal preview build to the QA team and stakeholders for initial feedback.',
        status: 'todo',
        priority: 'low',
        dueDate: null, // Undated
        assignees: ['ethan.brooks@example.com'],
        position: 2000,
        comments: [],
      },
    ],
  },
  {
    name: 'Customer Portal Revamp',
    description: 'Improving the customer portal with better account management, user workflows, and a refreshed interface.',
    color: '#10B981', // Emerald
    memberRoles: [
      { email: 'orbit.demo@example.com', role: 'owner' },
      { email: 'sarah.chen@example.com', role: 'member' },
      { email: 'daniel.wilson@example.com', role: 'member' },
      { email: 'maya.patel@example.com', role: 'member' },
    ],
    tasks: [
      {
        title: 'Customer journey mapping & friction audit',
        description: 'Analyze telemetry and user support inquiries to identify dropped onboarding and billing flows.',
        status: 'done',
        priority: 'medium',
        dueDate: getDateOffset(-10),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Design clean customer account settings modal',
        description: 'Provide intuitive profile updates, email change, and password reset interfaces.',
        status: 'done',
        priority: 'high',
        dueDate: getDateOffset(-3),
        assignees: ['sarah.chen@example.com'],
        position: 2000,
        comments: [
          { author: 'sarah.chen@example.com', body: 'Modal designs adhere to the new Orbit design tokens.', offsetHours: -70 },
        ],
      },
      {
        title: 'Implement self-serve team member invitation workflow',
        description: 'Allow project owners to invite colleagues by email and set initial project permissions (member, admin).',
        status: 'in_progress',
        priority: 'high',
        dueDate: getDateOffset(2),
        assignees: ['maya.patel@example.com', 'orbit.demo@example.com'],
        position: 1000,
        comments: [
          { author: 'orbit.demo@example.com', body: 'The member invite endpoint is functioning with proper role validation.', offsetHours: -14 },
        ],
      },
      {
        title: 'Implement real-time project invitation email dispatch',
        description: 'Connect notification dispatch with template rendering for clean HTML email invitations.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: getDateOffset(4),
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Review customer invoice & billing history download',
        description: 'Ensure PDF generation and receipt download links are secured by customer ownership checks.',
        status: 'review',
        priority: 'low',
        dueDate: getDateOffset(1),
        assignees: ['daniel.wilson@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Security review of session expiration & remember-me tokens',
        description: 'Validate HMAC-SHA256 session token hashing and cookie flags (SameSite=Lax, HttpOnly).',
        status: 'review',
        priority: 'critical',
        dueDate: getDateOffset(-3), // Overdue
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [
          { author: 'maya.patel@example.com', body: 'Security review confirmed: 256-bit entropy tokens with zero plaintext token storage.', offsetHours: -48 },
        ],
      },
      {
        title: 'Customer feedback widget integration',
        description: 'Add unobtrusive feedback form in customer portal footer for rapid reporting.',
        status: 'todo',
        priority: 'low',
        dueDate: getDateOffset(12),
        assignees: ['sarah.chen@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Prepare end-user release notes & documentation',
        description: 'Draft summary of new portal enhancements for customer success and distribution.',
        status: 'todo',
        priority: 'medium',
        dueDate: null, // Undated
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
    ],
  },
  {
    name: 'Q4 Marketing Campaign',
    description: 'Coordinating campaign strategy, landing pages, content production, and launch activities.',
    color: '#F59E0B', // Amber
    memberRoles: [
      { email: 'orbit.demo@example.com', role: 'owner' },
      { email: 'sarah.chen@example.com', role: 'admin' },
      { email: 'daniel.wilson@example.com', role: 'member' },
    ],
    tasks: [
      {
        title: 'Define Q4 messaging pillars & product positioning',
        description: 'Craft core value propositions focusing on real-time team collaboration, security, and velocity.',
        status: 'done',
        priority: 'high',
        dueDate: getDateOffset(-12),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Design high-converting campaign landing page',
        description: 'Create interactive hero section demonstrating Kanban card drag-and-drop and live collaboration.',
        status: 'done',
        priority: 'high',
        dueDate: getDateOffset(-6),
        assignees: ['sarah.chen@example.com'],
        position: 2000,
        comments: [
          { author: 'sarah.chen@example.com', body: 'Hero assets exported with WebP optimization.', offsetHours: -130 },
        ],
      },
      {
        title: 'Implement landing page animations & micro-interactions',
        description: 'Add subtle hover elevation and smooth scroll transitions matching Linear design standards.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: getDateOffset(1),
        assignees: ['daniel.wilson@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Draft email newsletter sequence for product announcement',
        description: 'Write 4-part email series covering modern collaboration, Kanban efficiency, and demo walkthrough.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: getDateOffset(3),
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Review campaign tracking UTM parameters & conversion events',
        description: 'Verify analytics tagging across all call-to-action buttons and registration funnels.',
        status: 'review',
        priority: 'high',
        dueDate: getDateOffset(0), // Due Today
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [
          { author: 'orbit.demo@example.com', body: 'UTM parameters mapped and tested in staging environment.', offsetHours: -4 },
        ],
      },
      {
        title: 'Social media visual banners & launch teaser video',
        description: 'Produce animated 15-second teaser clip showcasing real-time task movement on Orbit boards.',
        status: 'review',
        priority: 'medium',
        dueDate: getDateOffset(-1), // Overdue
        assignees: ['sarah.chen@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Coordinate partner co-marketing announcements',
        description: 'Reach out to developer community newsletters and featured tool roundups.',
        status: 'todo',
        priority: 'low',
        dueDate: getDateOffset(8),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Monitor launch day conversion metrics & user signups',
        description: 'Track real-time sign-ups, demo workspace logins, and user feedback post-launch.',
        status: 'todo',
        priority: 'critical',
        dueDate: getDateOffset(15),
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
    ],
  },
  {
    name: 'API Performance Optimization',
    description: 'Improving backend response times, database queries, caching, and API reliability.',
    color: '#8B5CF6', // Purple
    memberRoles: [
      { email: 'orbit.demo@example.com', role: 'owner' },
      { email: 'maya.patel@example.com', role: 'admin' },
      { email: 'ethan.brooks@example.com', role: 'member' },
    ],
    tasks: [
      {
        title: 'Profile slow SQL queries on project & task lists',
        description: 'Identify unindexed joins and optimize JSON aggregation queries in projectService and taskService.',
        status: 'done',
        priority: 'high',
        dueDate: getDateOffset(-14),
        assignees: ['maya.patel@example.com'],
        position: 1000,
        comments: [
          { author: 'maya.patel@example.com', body: 'Optimized project list query: consolidated task and member counts into single-pass aggregations.', offsetHours: -260 },
        ],
      },
      {
        title: 'Add compound indexes on task_assignees & project_members',
        description: 'Create idx_ta_project_user and idx_pm_user_id for instantaneous permission lookups.',
        status: 'done',
        priority: 'critical',
        dueDate: getDateOffset(-7),
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Benchmark serverless cold start times on Vercel',
        description: 'Measure execution duration across /api/auth/me, /api/projects, and task endpoints under cold conditions.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: getDateOffset(2),
        assignees: ['ethan.brooks@example.com'],
        position: 1000,
        comments: [
          { author: 'ethan.brooks@example.com', body: 'Cold starts with Neon connection pooling are averaging under 350ms, well within target.', offsetHours: -8 },
        ],
      },
      {
        title: 'Implement ETags & conditional HTTP 304 caching for static assets',
        description: 'Configure Cache-Control headers for CSS, client JavaScript modules, and images.',
        status: 'in_progress',
        priority: 'low',
        dueDate: getDateOffset(5),
        assignees: ['maya.patel@example.com', 'orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Load test task movement endpoint under concurrent traffic',
        description: 'Simulate 50 concurrent users updating task positions simultaneously to verify lock contention behavior.',
        status: 'review',
        priority: 'high',
        dueDate: getDateOffset(-2), // Overdue
        assignees: ['ethan.brooks@example.com'],
        position: 1000,
        comments: [
          { author: 'ethan.brooks@example.com', body: 'Executed 1,000 automated drag operations. Zero position collision or deadlocks observed.', offsetHours: -30 },
        ],
      },
      {
        title: 'Optimize Express middleware pipeline & CORS validation',
        description: 'Streamline regex matching in origin validators to reduce per-request CPU cycle overhead.',
        status: 'review',
        priority: 'medium',
        dueDate: getDateOffset(1),
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Implement database connection keep-alive tuning',
        description: 'Configure pool max connections and idle timeouts for Neon serverless architecture.',
        status: 'todo',
        priority: 'medium',
        dueDate: getDateOffset(7),
        assignees: ['maya.patel@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Publish API performance audit summary & recommendations',
        description: 'Document latency benchmarks, throughput metrics, and ongoing monitoring guidelines.',
        status: 'todo',
        priority: 'low',
        dueDate: null, // Undated
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
    ],
  },
  {
    name: 'Internal Knowledge Base',
    description: 'Creating a central documentation and onboarding workspace for the organization.',
    color: '#14B8A6', // Teal
    memberRoles: [
      { email: 'orbit.demo@example.com', role: 'owner' },
      { email: 'sarah.chen@example.com', role: 'member' },
      { email: 'maya.patel@example.com', role: 'member' },
    ],
    tasks: [
      {
        title: 'Audit existing engineering onboarding documentation',
        description: 'Gather repository setup guides, environment variable references, and architecture diagrams.',
        status: 'done',
        priority: 'medium',
        dueDate: getDateOffset(-15),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Draft standard operating procedures for code reviews',
        description: 'Document branch naming conventions, PR template guidelines, and testing coverage expectations.',
        status: 'done',
        priority: 'low',
        dueDate: getDateOffset(-8),
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [
          { author: 'maya.patel@example.com', body: 'Drafted guidelines published to internal wiki.', offsetHours: -180 },
        ],
      },
      {
        title: 'Write local development environment setup walkthrough',
        description: 'Step-by-step guide covering Node 26 LTS installation, Neon database branching, and test suites.',
        status: 'in_progress',
        priority: 'high',
        dueDate: getDateOffset(2),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Create security best practices & credential management guide',
        description: 'Guidelines on zero secret check-ins, CSRF protection, and signed session cookies.',
        status: 'in_progress',
        priority: 'critical',
        dueDate: getDateOffset(4),
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Design searchable documentation index & tag taxonomy',
        description: 'Establish category hierarchy (Architecture, Deployment, Security, UI Standards).',
        status: 'review',
        priority: 'medium',
        dueDate: getDateOffset(0), // Due Today
        assignees: ['sarah.chen@example.com'],
        position: 1000,
        comments: [
          { author: 'sarah.chen@example.com', body: 'Tagging structure ready for team review.', offsetHours: -5 },
        ],
      },
      {
        title: 'Review production incident response runbooks',
        description: 'Verify escalation protocols, database rollback procedures, and health check monitoring.',
        status: 'review',
        priority: 'high',
        dueDate: getDateOffset(-1), // Overdue
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Collect new hire feedback on first-week onboarding experience',
        description: 'Interview recent teammates to identify points of confusion or documentation gaps.',
        status: 'todo',
        priority: 'low',
        dueDate: getDateOffset(11),
        assignees: ['sarah.chen@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Schedule quarterly documentation review & maintenance cycle',
        description: 'Set recurring calendar cadence to review, prune, and refresh out-of-date technical docs.',
        status: 'todo',
        priority: 'low',
        dueDate: null, // Undated
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
    ],
  },
  {
    name: 'Product Analytics Dashboard',
    description: 'Building reporting capabilities for product engagement, usage insights, and operational metrics.',
    color: '#EC4899', // Pink
    memberRoles: [
      { email: 'orbit.demo@example.com', role: 'owner' },
      { email: 'daniel.wilson@example.com', role: 'member' },
      { email: 'maya.patel@example.com', role: 'member' },
      { email: 'ethan.brooks@example.com', role: 'member' },
    ],
    tasks: [
      {
        title: 'Define core product KPI definitions & event schemas',
        description: 'Standardize metrics: Active Workspaces, Tasks Created, Tasks Completed, and Velocity per Project.',
        status: 'done',
        priority: 'critical',
        dueDate: getDateOffset(-16),
        assignees: ['orbit.demo@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Implement database aggregation functions for workspace stats',
        description: 'Create fast SQL views computing completed vs total tasks with zero N+1 query overhead.',
        status: 'done',
        priority: 'high',
        dueDate: getDateOffset(-9),
        assignees: ['maya.patel@example.com'],
        position: 2000,
        comments: [
          { author: 'maya.patel@example.com', body: 'Aggregation queries benchmarked at under 15ms.', offsetHours: -210 },
        ],
      },
      {
        title: 'Build workflow distribution bar visualization component',
        description: 'Render responsive 4-column segmented proportional bar showing To Do, In Progress, Review, Done.',
        status: 'in_progress',
        priority: 'high',
        dueDate: getDateOffset(1),
        assignees: ['daniel.wilson@example.com', 'orbit.demo@example.com'],
        position: 1000,
        comments: [
          { author: 'daniel.wilson@example.com', body: 'Proportional width calculation updated to handle edge case of zero tasks smoothly.', offsetHours: -14 },
        ],
      },
      {
        title: 'Implement active project metrics summary cards',
        description: 'Display 4 key stats (Active Projects, Open Tasks, In Progress, Completed) with subtle icon badges.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: getDateOffset(3),
        assignees: ['daniel.wilson@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Validate analytics data accuracy against raw database counts',
        description: 'Compare aggregated dashboard card figures with direct SQL COUNT queries to ensure 100% precision.',
        status: 'review',
        priority: 'critical',
        dueDate: getDateOffset(0), // Due Today
        assignees: ['ethan.brooks@example.com', 'orbit.demo@example.com'],
        position: 1000,
        comments: [
          { author: 'ethan.brooks@example.com', body: 'All 4 metric cards match exact database counts.', offsetHours: -3 },
        ],
      },
      {
        title: 'Optimize client-side metric calculation latency',
        description: 'Batch project task fetches using Promise.allSettled to load all columns simultaneously.',
        status: 'review',
        priority: 'medium',
        dueDate: getDateOffset(-2), // Overdue
        assignees: ['daniel.wilson@example.com'],
        position: 2000,
        comments: [],
      },
      {
        title: 'Add export to CSV capability for task velocity reports',
        description: 'Allow workspace administrators to download historical task delivery records in CSV format.',
        status: 'todo',
        priority: 'low',
        dueDate: getDateOffset(9),
        assignees: ['maya.patel@example.com'],
        position: 1000,
        comments: [],
      },
      {
        title: 'Conduct weekly analytics review meeting with stakeholders',
        description: 'Present workspace velocity insights and task completion trends to leadership.',
        status: 'todo',
        priority: 'medium',
        dueDate: null, // Undated
        assignees: ['orbit.demo@example.com'],
        position: 2000,
        comments: [],
      },
    ],
  },
];

/**
 * Main seeding execution
 */
async function seedDemoWorkspace(isReset = false) {
  console.log('====================================================');
  console.log(`[Orbit Demo Seeding] Mode: ${isReset ? 'RESET & RE-SEED' : 'ADDITIVE & IDEMPOTENT'}`);
  console.log('====================================================');

  await withTransaction(async (client) => {
    // ---------------------------------------------------------
    // 1. Provision Demo Users
    // ---------------------------------------------------------
    console.log('\n[1/5] Provisioning sample team members...');
    const userMap = new Map(); // email -> userRow

    for (const u of SAMPLE_USERS) {
      const passwordHash = await hashPassword(u.password);

      // Check existing user by case-insensitive email
      const existing = await client.query(
        'SELECT id, name, email, avatar_color FROM users WHERE LOWER(email) = LOWER($1)',
        [u.email]
      );

      if (existing.rows.length > 0) {
        // Update user properties to ensure password and details match demo spec
        const updated = await client.query(
          `UPDATE users
           SET name = $1, password_hash = $2, avatar_color = $3, updated_at = NOW()
           WHERE id = $4
           RETURNING id, name, email, avatar_color`,
          [u.name, passwordHash, u.avatarColor, existing.rows[0].id]
        );
        userMap.set(u.email.toLowerCase(), updated.rows[0]);
        console.log(`  ✓ Updated demo user: ${u.name} <${u.email}>`);
      } else {
        const inserted = await client.query(
          `INSERT INTO users (name, email, password_hash, avatar_color)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, email, avatar_color`,
          [u.name, u.email.toLowerCase(), passwordHash, u.avatarColor]
        );
        userMap.set(u.email.toLowerCase(), inserted.rows[0]);
        console.log(`  + Created demo user: ${u.name} <${u.email}>`);
      }
    }

    const demoOwner = userMap.get(DEMO_CREDENTIALS.email.toLowerCase());
    if (!demoOwner) {
      throw new Error(`Critical: Demo owner ${DEMO_CREDENTIALS.email} could not be provisioned.`);
    }

    // ---------------------------------------------------------
    // 2. Handle Operator Reset (if requested)
    // ---------------------------------------------------------
    if (isReset) {
      console.log('\n[2/5] Operator Reset: Cleaning existing demo projects and tasks...');
      // Safely delete only projects owned by the demo owner
      const delProjects = await client.query(
        'DELETE FROM projects WHERE owner_id = $1 RETURNING id, name',
        [demoOwner.id]
      );
      console.log(`  - Removed ${delProjects.rowCount} previous demo-owned project(s) and cascading records.`);
    } else {
      console.log('\n[2/5] Preserving existing data (additive update mode)...');
    }

    // ---------------------------------------------------------
    // 3. Provision Sample Projects & Memberships
    // ---------------------------------------------------------
    console.log('\n[3/5] Provisioning sample projects and team memberships...');
    let totalProjectsCreated = 0;
    let totalProjectsUpdated = 0;
    const projectMap = new Map(); // projectName -> projectId

    for (const p of SAMPLE_PROJECTS) {
      let projectId;

      // Check if project already exists for this demo owner
      const existingProj = await client.query(
        'SELECT id FROM projects WHERE owner_id = $1 AND name = $2',
        [demoOwner.id, p.name]
      );

      if (existingProj.rows.length > 0) {
        projectId = existingProj.rows[0].id;
        await client.query(
          `UPDATE projects
           SET description = $1, color = $2, is_archived = false, updated_at = NOW()
           WHERE id = $3`,
          [p.description, p.color, projectId]
        );
        totalProjectsUpdated++;
      } else {
        const newProj = await client.query(
          `INSERT INTO projects (name, description, color, owner_id, is_archived)
           VALUES ($1, $2, $3, $4, false)
           RETURNING id`,
          [p.name, p.description, p.color, demoOwner.id]
        );
        projectId = newProj.rows[0].id;
        totalProjectsCreated++;
      }

      projectMap.set(p.name, projectId);

      // Add/ensure project members
      for (const m of p.memberRoles) {
        const memberUser = userMap.get(m.email.toLowerCase());
        if (!memberUser) continue;

        // Upsert into project_members
        await client.query(
          `INSERT INTO project_members (project_id, user_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (project_id, user_id)
           DO UPDATE SET role = EXCLUDED.role`,
          [projectId, memberUser.id, m.role]
        );
      }

      console.log(`  ✓ Project ready: "${p.name}" (${p.memberRoles.length} members)`);
    }

    // ---------------------------------------------------------
    // 4. Provision Sample Tasks & Assignees
    // ---------------------------------------------------------
    console.log('\n[4/5] Provisioning sample tasks and assignments...');
    let totalTasksCount = 0;
    let totalCommentsCount = 0;
    const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };

    for (const p of SAMPLE_PROJECTS) {
      const projectId = projectMap.get(p.name);
      if (!projectId) continue;

      for (const t of p.tasks) {
        let taskId;

        // Check if task exists by (project_id, title)
        const existingTask = await client.query(
          'SELECT id FROM tasks WHERE project_id = $1 AND title = $2',
          [projectId, t.title]
        );

        if (existingTask.rows.length > 0) {
          taskId = existingTask.rows[0].id;
          await client.query(
            `UPDATE tasks
             SET description = $1, status = $2, priority = $3, due_date = $4, position = $5, is_archived = false, updated_at = NOW()
             WHERE id = $6`,
            [t.description, t.status, t.priority, t.dueDate, t.position, taskId]
          );
        } else {
          const newTask = await client.query(
            `INSERT INTO tasks (project_id, created_by, title, description, status, priority, due_date, position, is_archived)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
             RETURNING id`,
            [projectId, demoOwner.id, t.title, t.description, t.status, t.priority, t.dueDate, t.position]
          );
          taskId = newTask.rows[0].id;
        }

        totalTasksCount++;
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

        // Assign users to task (ensure they are project members)
        for (const assigneeEmail of t.assignees) {
          const assigneeUser = userMap.get(assigneeEmail.toLowerCase());
          if (!assigneeUser) continue;

          await client.query(
            `INSERT INTO task_assignees (task_id, user_id, project_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (task_id, user_id) DO NOTHING`,
            [taskId, assigneeUser.id, projectId]
          );
        }

        // -----------------------------------------------------
        // 5. Provision Sample Comments
        // -----------------------------------------------------
        if (Array.isArray(t.comments)) {
          for (const c of t.comments) {
            const authorUser = userMap.get(c.author.toLowerCase());
            if (!authorUser) continue;

            // Check if comment already exists for this task by this author with exact text
            const existingComment = await client.query(
              'SELECT id FROM task_comments WHERE task_id = $1 AND author_id = $2 AND body = $3',
              [taskId, authorUser.id, c.body]
            );

            if (existingComment.rows.length === 0) {
              const commentDate = new Date();
              commentDate.setHours(commentDate.getHours() + (c.offsetHours || 0));

              await client.query(
                `INSERT INTO task_comments (task_id, author_id, body, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $4)`,
                [taskId, authorUser.id, c.body, commentDate.toISOString()]
              );
              totalCommentsCount++;
            }
          }
        }
      }
    }

    // ---------------------------------------------------------
    // Summary Output
    // ---------------------------------------------------------
    console.log('\n====================================================');
    console.log('✓ ORBIT DEMO SEEDING COMPLETED SUCCESSFULLY');
    console.log('====================================================');
    console.log(`Team members provisioned: ${userMap.size}`);
    console.log(`Projects configured:     ${SAMPLE_PROJECTS.length} (${totalProjectsCreated} created, ${totalProjectsUpdated} updated)`);
    console.log(`Tasks provisioned:        ${totalTasksCount}`);
    console.log(`  - To Do:        ${statusCounts.todo}`);
    console.log(`  - In Progress:  ${statusCounts.in_progress}`);
    console.log(`  - In Review:    ${statusCounts.review}`);
    console.log(`  - Done:         ${statusCounts.done}`);
    console.log(`Task comments added:     ${totalCommentsCount}`);
    console.log('----------------------------------------------------');
    console.log('DEMO LOGIN CREDENTIALS:');
    console.log(`Email:    ${DEMO_CREDENTIALS.email}`);
    console.log(`Password: ${DEMO_CREDENTIALS.password}`);
    console.log('====================================================\n');
  });
}

// Check CLI arguments
const isResetMode = process.argv.includes('--reset');

seedDemoWorkspace(isResetMode)
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n[Orbit Demo Seeding Error]:', err);
    await closePool();
    process.exit(1);
  });
