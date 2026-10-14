// SubagentStop. Reviewers: record that a review happened (feeds the lead's review gate).
// Builders / testers: they cannot finish while their own files fail lint, typecheck or tests.
import {
  readInput, pass, block, resolveRole, loadState, saveState, projectRoot,
  eslint, typecheck, runTests, summarize,
} from './lib.mjs';

const input = readInput();
const { role, agent } = resolveRole(input);
const state = loadState(input);

if (role === 'reviewer' || role === 'investigator') {
  state.reviews.push({ agent, at: Date.now() });
  if (state.reviews.length > 200) state.reviews = state.reviews.slice(-200);
  saveState(input, state);
  pass();
}

if (input.stop_hook_active) pass(); // already sent back once; don't loop

const mine = [...new Set(
  state.changes.filter((c) => c.agentId && c.agentId === input.agent_id).map((c) => c.file),
)];
if (mine.length === 0) pass();

const root = projectRoot(input);
const results = [];

if (role === 'builder' || role === 'refactorer') {
  results.push(eslint(root, mine));
  results.push(typecheck(root));
}
if (role === 'tester') {
  results.push(eslint(root, mine));
  results.push(runTests(root, mine));
}

const failures = summarize(results);
if (failures) {
  block(`${agent}: your changes do not pass the checks yet. Fix the problems in your own scope, then finish. If a failure is outside your scope, say so in your report.\n\n${failures}`);
}
pass();
