const fs = require('fs');

const files = [
  'public/index.html',
  'public/pages/auth.html',
  'public/pages/dashboard.html',
  'public/pages/projects.html',
  'public/pages/board.html',
  'public/pages/members.html',
];

let allOk = true;

files.forEach((f) => {
  const content = fs.readFileSync(f, 'utf8');
  const hasAntiFouc = content.includes('orbit-theme');
  const hasToggleBtn = content.includes('btn-theme-toggle');
  const hasThemeJs = content.includes('theme.js');

  console.log(`${f.padEnd(30)} -> Anti-FOUC: ${hasAntiFouc ? 'PASS' : 'FAIL'}, Button: ${hasToggleBtn ? 'PASS' : 'FAIL'}, ThemeJS: ${hasThemeJs ? 'PASS' : 'FAIL'}`);

  if (!hasAntiFouc || !hasToggleBtn || !hasThemeJs) {
    allOk = false;
  }
});

if (allOk) {
  console.log('\nAll pages verified: Anti-FOUC scripts, Theme Toggle buttons, and Theme scripts are present.');
} else {
  console.error('\nVerification failed on one or more pages.');
  process.exit(1);
}
