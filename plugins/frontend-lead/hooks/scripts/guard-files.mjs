// PreToolUse for Read | Edit | Write | MultiEdit | NotebookEdit.
// Enforces: secrets are never read or written, generated/lock files are never hand-edited,
// each role writes only its own kind of file, and banned code patterns are never introduced.
import {
  readInput, decide, pass, resolveRole, roleRules, relPath, categorize,
  writtenText, contentViolations,
} from './lib.mjs';

const input = readInput();
const tool = input.tool_name || '';
const ti = input.tool_input || {};
const file = ti.file_path || ti.notebook_path || ti.path || '';
if (!file) pass();

const rel = relPath(input, file);
const category = categorize(rel);
const { role, agent } = resolveRole(input);
const isSubagent = role !== 'lead';
const who = isSubagent ? `${agent} (${role})` : 'the lead';

// Reading: only secrets are off limits.
if (tool === 'Read') {
  if (category === 'secret') {
    decide('deny', `${rel} looks like a secret file. Secrets are never read into the conversation. Use .env.example for variable names.`);
  }
  pass();
}

// ---- writing ----

if (category === 'secret') {
  decide('deny', `${rel} is a secret file. No role may write it. Ask the user to change it manually.`);
}

if (category === 'locked') {
  decide('deny', `${rel} is generated (lockfile or build output). Never edit it by hand. Dependency changes go through the lead and the package manager.`);
}

if (category === 'outside') {
  decide(isSubagent ? 'deny' : 'ask', `${file} is outside the project folder.`);
}

if (category === 'protected') {
  // Quality gates and rules can only change with the user's explicit approval.
  if (isSubagent) {
    decide('deny', `${rel} is a protected config/rules file (lint, TS, test, CI, package.json, CLAUDE.md, .claude/). Subagents cannot change quality gates. Report the needed change to the lead.`);
  }
  decide('ask', `${rel} is a protected config/rules file. Changing it changes the team's quality gates. Approve only if you asked for this change.`);
}

const rules = roleRules(role);
if (!rules.write.includes(category)) {
  const owner = {
    test: 'test-automator',
    docs: 'documentation-engineer',
    source: 'a builder (nextjs-developer, react-specialist, typescript-pro) or refactoring-specialist',
    asset: 'a builder',
  }[category] || 'the right role';
  const leadHint = role === 'lead'
    ? ' Strict delegation is on: the lead plans and delegates, it does not write code itself.'
    : '';
  decide('deny', `${who} may not write ${category} files (${rel}). This file is owned by ${owner}.${leadHint} Stop and report this to the lead instead of working around it.`);
}

// Banned patterns: only NEW occurrences are blocked.
const { before, after } = writtenText(tool, ti);
const violations = contentViolations(category, rel, before, after);
if (violations.length) {
  const list = violations.map((v) => `- ${v.msg}`).join('\n');
  const needsApproval = violations.every((v) => v.severity === 'approval');
  if (!isSubagent && needsApproval) {
    decide('ask', `This edit to ${rel} needs approval:\n${list}`);
  }
  decide('deny', `This edit to ${rel} introduces banned code:\n${list}\nRewrite it without these patterns.${isSubagent ? ' If it is truly unavoidable, report why to the lead.' : ' If it is truly unavoidable, explain why to the user and let them make the change.'}`);
}

pass();
