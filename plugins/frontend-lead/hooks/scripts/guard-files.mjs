// PreToolUse for Read | Edit | Write | MultiEdit | NotebookEdit.
// Enforces: secrets are never read or written, generated/lock files are never hand-edited,
// each role writes only its own kind of file, and banned code patterns are never introduced.
import fs from 'node:fs';
import path from 'node:path';
import {
  readInput, decide, pass, resolveRole, roleRules, relPath, categorize,
  writtenText, contentViolations, loadState, saveState, options, projectRoot,
} from './lib.mjs';
import { modeRules, CODE_MODES } from './autopilot.mjs';

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
const state = loadState(input);

// Autopilot: in a workflow task the lead delegates code to the owning role.
if (role === 'lead' && options().autopilot && (category === 'source' || category === 'test')) {
  const task = state.task;
  const mode = task?.mode || 'none';
  if (mode === 'plan' || mode === 'review') {
    decide('deny', `This is a ${mode}-only request: no code changes. Present the result and let the user decide.`);
  }
  const lockedForLead = (CODE_MODES.includes(mode) && !modeRules(mode).leadWritesCode) || mode === 'none' || mode === 'question';
  if (lockedForLead) {
    if (!task || !CODE_MODES.includes(mode)) {
      // The request turned into a code change: start a "change" task so the gates apply.
      state.task = { id: `${Date.now()}`, mode: 'change', promptId: input.prompt_id || null, startedAt: Date.now(), rounds: 0, approved: true, status: 'active' };
      saveState(input, state);
    }
    const owner = category === 'test'
      ? 'frontend-lead:test-automator'
      : 'the builder that owns it (frontend-lead:nextjs-developer for routes/server/metadata, frontend-lead:react-specialist for components/hooks, frontend-lead:typescript-pro for types/schemas/libs, frontend-lead:refactoring-specialist for refactors)';
    decide('deny', `Autopilot: the lead does not write ${category === 'test' ? 'tests' : 'production code'} in a ${state.task.mode} task. Delegate ${rel} to ${owner} with a brief (goal, exact file scope, acceptance criteria). For a tiny edit the user can prefix the request with "quick:".`);
  }
}

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

// Remember new files: they pull in tests (change mode) and the architecture review.
if (tool === 'Write' && (category === 'source' || category === 'test')
  && !fs.existsSync(path.join(projectRoot(input), rel))) {
  state.created[rel] = Date.now();
  saveState(input, state);
}

pass();
