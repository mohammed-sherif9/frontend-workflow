// PostToolUse for Edit | Write | MultiEdit.
// Records the change (for the verify + review gates), formats it, and feeds lint errors straight back.
import fs from 'node:fs';
import path from 'node:path';
import {
  readInput, pass, block, resolveRole, relPath, categorize, isCodeFile,
  loadState, saveState, projectRoot, findBin, run, eslint, tail, options,
} from './lib.mjs';

const input = readInput();
const file = input.tool_input?.file_path || '';
if (!file) pass();

const root = projectRoot(input);
const rel = relPath(input, file);
const category = categorize(rel);
if (['outside', 'secret', 'locked'].includes(category)) pass();

const { role, agent } = resolveRole(input);

// 1. Record the change.
const state = loadState(input);
state.changes.push({ file: rel, category, role, agent, agentId: input.agent_id || null, at: Date.now() });
if (state.changes.length > 500) state.changes = state.changes.slice(-500);
saveState(input, state);

if (!options().lintOnEdit || !fs.existsSync(path.join(root, rel))) pass();

// 2. Format (silently) when Prettier is installed.
const prettier = findBin(root, 'prettier');
if (prettier && /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|json|md|mdx|ya?ml)$/.test(rel)) {
  run(prettier, ['--write', '--log-level', 'silent', rel], root, 60000);
}

// 3. Lint with autofix; anything left is sent back to Claude to fix now.
if (isCodeFile(rel)) {
  const result = eslint(root, [rel], true);
  if (result && !result.ok && !result.timedOut) {
    block(`ESLint still reports problems in ${rel} after autofix. Fix them before moving on (do not disable the rule):\n${tail(result.output, 3000)}`);
  }
}

pass();
