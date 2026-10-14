// Stop (main session). Before the lead can report "done":
//   1. verify gate: typecheck + lint + related tests on everything changed since the last pass
//   2. review gate: changed code must have gone through at least one reviewer subagent
import {
  readInput, pass, block, loadState, saveState, projectRoot, options,
  typecheck, eslint, relatedTests, summarize,
} from './lib.mjs';

const input = readInput();
if (input.stop_hook_active) pass(); // never trap the session in a loop

const opts = options();
const state = loadState(input);
const since = state.verifiedAt || 0;
const codeChanges = state.changes.filter((c) => c.at > since && (c.category === 'source' || c.category === 'test'));
if (codeChanges.length === 0) pass();

const files = [...new Set(codeChanges.map((c) => c.file))];
const root = projectRoot(input);

if (opts.verifyOnStop) {
  const failures = summarize([typecheck(root), eslint(root, files), relatedTests(root, files)]);
  if (failures) {
    block(`Checks fail on the changed files. Delegate the fixes to the owning role (builder for code, test-automator for tests) or use the debugger if the cause is unclear, then finish.\n\n${failures}`);
  }
}

if (opts.reviewGate) {
  const lastChange = Math.max(...codeChanges.map((c) => c.at));
  const reviewedAfter = state.reviews.some((r) => r.at > lastChange);
  if (!reviewedAfter) {
    block(`${files.length} code file(s) changed and no reviewer has looked at them since:\n${files.slice(0, 15).map((f) => `- ${f}`).join('\n')}\nRun the review step (/frontend-lead:review, or at least code-reviewer) and fix BLOCKER/MAJOR findings before finishing. If the user explicitly said to skip review, say that in your final message.`);
  }
}

state.verifiedAt = Date.now();
saveState(input, state);
pass();
