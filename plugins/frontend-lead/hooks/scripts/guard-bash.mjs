// PreToolUse for Bash. Blocks dangerous commands for everyone, keeps read-only roles read-only,
// and keeps git history and dependencies in the lead's (and the user's) hands.
import { readInput, decide, pass, resolveRole, roleRules } from './lib.mjs';

const input = readInput();
const cmd = String(input.tool_input?.command || '');
if (!cmd.trim()) pass();

const { role, agent } = resolveRole(input);
const rules = roleRules(role);
const isSubagent = role !== 'lead';
const who = isSubagent ? `${agent} (${role})` : 'the lead';

const has = (re) => re.test(cmd);

// 1. Never allowed, for anyone.
const NEVER = [
  [/--no-verify\b|\bgit\s+commit\b[^|;&]*\s-n\b/, 'Skipping git hooks (--no-verify) bypasses the quality gates.'],
  [/\bgit\s+push\b[^|;&]*(\s--force\b|\s-f\b|--force-with-lease)/, 'Force push rewrites shared history.'],
  [/\b(npm|pnpm|yarn|bun)\s+publish\b/, 'Publishing packages is a release decision for the user.'],
  [/\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(-[a-zA-Z]+\s+)*(\/|~|\$HOME|\.\.?)(\/)?(\s|$)/, 'Recursive delete of root, home, or the whole project.'],
  [/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/, 'Piping a downloaded script into a shell.'],
  [/(^|[\s;&|(])(cat|less|more|head|tail|bat|grep|rg|source|\.)\s+([^|;&]*[\s/])?\.env(?!\.example)(\.[\w.-]+)?(\s|$)/, 'Reading secret .env files.'],
  [/\b(printenv|env)\s*($|[|;&])/, 'Dumping environment variables can leak secrets.'],
];
for (const [re, why] of NEVER) {
  if (has(re)) decide('deny', `Blocked command. ${why}`);
}

// 2. No Bash at all for some roles.
if (rules.bash === 'none') decide('deny', `${who} has no shell access.`);

// Patterns shared by the remaining checks.
const DEP_CHANGE = /\b(npm\s+(i|install|add|uninstall|remove|rm|update|up|upgrade)\b(?=[^|;&]*\s[@\w])|pnpm\s+(add|remove|rm|update|up|install\s+[@\w])|yarn\s+(add|remove|upgrade|up)\b|bun\s+(add|remove|update)\b|npx\s+(npm-check-updates|ncu)\b)/;
const GIT_WRITE = /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|switch|restore|stash|cherry-pick|revert|tag|am|apply|clean|rm|mv|branch\s+-[dDmMcC]|worktree\s+(add|remove))\b/;
const GIT_DANGER = /\bgit\s+(push|reset\s+--hard|clean\s+-[a-zA-Z]*f|checkout\s+(--\s+)?\.(\s|$)|restore\s+(--\S+\s+)*\.(\s|$)|branch\s+-D)\b/;

// 3. Read-only roles: nothing that changes files, git or dependencies.
if (rules.bash === 'readonly') {
  const WRITES = [
    /(^|[^0-9&>])>{1,2}(?!\s*(\/dev\/null|&))/, // output redirection into a file
    /\btee\b/,
    /\b(rm|rmdir|mv|cp|mkdir|touch|chmod|chown|ln|truncate|dd)\s/,
    /\bsed\s+(-[a-zA-Z]*i|--in-place)/,
    /\bperl\s+-[a-zA-Z]*i/,
    /--fix\b|--write\b|\s-w\s|--update-snapshots?\b|\s-u(\s|$)/,
    /\b(npm|pnpm|yarn|bun)\s+(i|install|ci|add|remove|uninstall|update|up|upgrade|link|dedupe|prune)\b/,
    /\bnpx\s+(--yes|-y)\b/,
    /\b(node|python3?|ruby|perl)\s+-(e|c)\b/,
    /\bnpm\s+audit\s+fix\b/,
  ];
  if (has(GIT_WRITE) || WRITES.some(has)) {
    decide('deny', `${who} is read-only. This command could change files, git state or dependencies. Run only checks (lint, typecheck, tests, audits, git diff/log/status) and report findings to the lead.`);
  }
  pass();
}

// 4. Builders / testers: may run project scripts, but git and dependencies belong to the lead.
if (rules.bash === 'build') {
  if (has(GIT_WRITE)) decide('deny', `${who} may not change git state. The lead commits after review. Report "ready to commit" instead.`);
  if (has(DEP_CHANGE)) decide('deny', `${who} may not add, remove or upgrade dependencies. Report the package and the reason; the lead runs dependency-manager first.`);
  if (/\bnpm\s+audit\s+fix\b/.test(cmd)) decide('deny', `${who} may not run audit fix; it changes dependencies.`);
  pass();
}

// 5. Lead: risky but sometimes legitimate -> ask the user.
if (has(DEP_CHANGE)) decide('ask', 'This changes dependencies. Run dependency-manager review first, then approve if you agree.');
if (has(GIT_DANGER)) decide('ask', 'This git command can discard work or publish history. Approve only if you meant it.');
if (/\brm\s+-[a-zA-Z]*r/.test(cmd)) decide('ask', 'Recursive delete. Check the path before approving.');

pass();
