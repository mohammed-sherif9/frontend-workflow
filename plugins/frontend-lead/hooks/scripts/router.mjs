// UserPromptSubmit: classify every request and inject the matching pipeline, so the workflow
// starts by itself for features, refactors, fixes and code changes. While a plan waits for
// approval, the user's reply decides: explicit approval unlocks building, anything else revises.
import { readInput, loadState, saveState, options } from './lib.mjs';
import { routeTask, pipelineBrief, approvalBrief } from './autopilot.mjs';

const input = readInput();
if (!options().autopilot) process.exit(0);

const state = loadState(input);
const parts = [];

// Tell Claude (and through it, the user) about steps left unfinished last time.
if (state.pendingNotice) {
  parts.push(`Note from frontend-lead: the previous task ended with workflow steps still open:\n${state.pendingNotice}\nMention this to the user and offer to finish them.`);
  state.pendingNotice = null;
}

const { task, continued, approval } = routeTask(state, input);
saveState(input, state);
parts.push(approval ? approvalBrief(task, approval) : pipelineBrief(task, continued));

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: parts.join('\n\n') } }),
);
