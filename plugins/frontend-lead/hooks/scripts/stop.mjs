// Stop (main session). The lead cannot finish until the task's workflow is complete:
//   plan (if required) → tests (if required) → verify (typecheck, lint, related tests) → reviewers → final gate.
// Each block lists the remaining steps in order. A per-task round limit prevents endless loops.
import {
  readInput, pass, block, loadState, saveState, projectRoot, options,
  typecheck, eslint, relatedTests, summarize,
} from './lib.mjs';
import { missingSteps, plannerDone, modeRules, taskChanges } from './autopilot.mjs';

const input = readInput();
const opts = options();
const state = loadState(input);
const task = state.task || { mode: 'none', startedAt: 0, rounds: 0 };

if (task.mode === 'off') pass();

// Waiting for the user to approve the plan is a legitimate place to stop.
if (opts.planApproval && modeRules(task.mode).plan && plannerDone(state, task) && !task.approved
  && taskChanges(state, task).every((c) => c.category !== 'source' && c.category !== 'test')) {
  task.status = 'awaiting-approval';
  saveState(input, state);
  pass();
}

const { steps, needsVerify, lastCodeAt } = missingSteps(state, task);

function finish() {
  task.status = 'done';
  state.task = task;
  saveState(input, state);
  pass();
}

function gate(lines) {
  task.rounds = (task.rounds || 0) + 1;
  if (task.rounds > opts.maxGateRounds) {
    // Give up gracefully: let Claude stop, and surface the open steps on the next prompt.
    state.pendingNotice = lines.join('\n');
    task.status = 'done';
    saveState(input, state);
    pass();
  }
  state.task = task;
  saveState(input, state);
  block(lines.join('\n'));
}

if (steps.length === 0 && !needsVerify) finish();

// Steps that must happen before verification (plan, tests) come first.
const before = steps.filter((s) => s.id === 'plan' || s.id === 'tests');
const after = steps.filter((s) => s.id !== 'plan' && s.id !== 'tests');
const header = `Autopilot (${task.mode}) — the task is not finished. Continue with these steps now, in order:`;

if (before.length) {
  gate([header, ...[...before, ...after].map((s, i) => `${i + 1}. ${s.text}`), `${before.length + after.length + 1}. Verification runs automatically after that.`]);
}

if (needsVerify && opts.verifyOnStop) {
  const root = projectRoot(input);
  const files = [...new Set(taskChanges(state, task)
    .filter((c) => c.category === 'source' || c.category === 'test')
    .map((c) => c.file))];
  const failures = summarize([typecheck(root), eslint(root, files), relatedTests(root, files)]);
  if (failures) {
    gate([
      `Autopilot (${task.mode}) — verification failed. Send each failure to the owning role (builder for code, test-automator for tests; debugger if the cause is unclear), then finish the remaining steps.`,
      '',
      failures,
    ]);
  }
  state.verifiedAt = Math.max(Date.now(), lastCodeAt + 1);
}

if (after.length && opts.reviewGate) {
  gate([header, ...after.map((s, i) => `${i + 1}. ${s.text}`)]);
}

finish();
