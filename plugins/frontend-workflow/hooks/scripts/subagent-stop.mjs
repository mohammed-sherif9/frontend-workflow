// SubagentStop. Records every finished subagent (the autopilot uses this to know which steps ran),
// and keeps builders / testers working until their own files pass lint, typecheck or tests.
import {
  readInput, pass, block, resolveRole, loadState, saveState, projectRoot,
  eslint, typecheck, runTests, summarize,
} from './lib.mjs';
import { approvalRequired } from './autopilot.mjs';

const input = readInput();
const { role, agent } = resolveRole(input);
const state = loadState(input);

const mine = [...new Set(
  state.changes.filter((c) => c.agentId && c.agentId === input.agent_id).map((c) => c.file),
)];

// Builders and testers must leave their own work green before they count as finished.
if ((role === 'builder' || role === 'refactorer' || role === 'tester') && mine.length && !input.stop_hook_active) {
  const root = projectRoot(input);
  const results = role === 'tester'
    ? [eslint(root, mine), runTests(root, mine)]
    : [eslint(root, mine), typecheck(root)];
  const failures = summarize(results);
  if (failures) {
    block(`${agent}: your changes do not pass the checks yet. Fix the problems in your own scope, then finish. If a failure is outside your scope, say so in your report.\n\n${failures}`);
  }
}

state.events.push({ agent, role, at: Date.now(), wrote: mine.length });

// A finished plan that needs the user's approval puts the task on hold until they approve.
if (role === 'planner' && state.task && state.task.status !== 'done'
  && approvalRequired(state.task.mode) && !state.task.approved) {
  state.task.status = 'awaiting-approval';
  state.task.planAt = Date.now();
}
if (state.events.length > 400) state.events = state.events.slice(-400);
saveState(input, state);
pass();
