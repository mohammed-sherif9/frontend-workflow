// UserPromptSubmit: classify every request and inject the matching pipeline, so the workflow
// starts by itself for features, refactors, fixes and code changes.
import { readInput, loadState, saveState, options } from './lib.mjs';
import { routeTask, pipelineBrief } from './autopilot.mjs';

const input = readInput();
if (!options().autopilot) process.exit(0);

const state = loadState(input);
const parts = [];

// Tell Claude (and through it, the user) about steps left unfinished last time.
if (state.pendingNotice) {
  parts.push(`Note from frontend-lead: the previous task ended with workflow steps still open:\n${state.pendingNotice}\nMention this to the user and offer to finish them.`);
  state.pendingNotice = null;
}

const { task, continued } = routeTask(state, input);
saveState(input, state);
parts.push(pipelineBrief(task, continued));

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: parts.join('\n\n') } }),
);
