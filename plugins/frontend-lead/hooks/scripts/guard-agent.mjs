// PreToolUse for Agent (main session). Keeps the pipeline in order:
// no building before planning, no building before the user has approved the plan,
// and no building at all in plan/review-only requests.
import { readInput, decide, pass, loadState, saveState, options } from './lib.mjs';
import { planRequired, approvalRequired, plannerDone, bareAgentName, roleOfAgent } from './autopilot.mjs';

const input = readInput();
if (input.agent_id || !options().autopilot) pass(); // subagents cannot spawn agents anyway

const target = bareAgentName(input.tool_input?.subagent_type || 'general-purpose');
const role = roleOfAgent(target);
const writes = ['builder', 'refactorer', 'tester', 'docs'].includes(role);
if (!writes) pass();

const state = loadState(input);
const task = state.task;
if (!task || task.status === 'done') pass();

if (task.mode === 'plan' || task.mode === 'review') {
  decide('deny', `This is a ${task.mode}-only request, so no code is written. Present the ${task.mode === 'plan' ? 'plan' : 'review'} and let the user decide.`);
}

if (planRequired(task.mode) && !plannerDone(state, task)) {
  decide('deny', `Autopilot (${task.mode}): plan before building. Delegate to frontend-lead:frontend-architect first${approvalRequired(task.mode) ? ', present the plan, and wait for the user\'s approval' : ''}.`);
}

if (approvalRequired(task.mode) && !task.approved) {
  task.status = 'awaiting-approval';
  saveState(input, state);
  decide('deny', 'The plan has not been approved by the user yet. Present the full plan, end with: Reply "approve" to start building, or tell me what to change. Then stop. Building is unlocked only after the user approves.');
}

pass();
