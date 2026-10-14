// PreToolUse for Agent (main session). Keeps the pipeline in order:
// no building before planning (when the mode needs a plan), no building in plan/review-only requests,
// and no building before the user approved the plan (when plan approval is on).
import { readInput, decide, pass, loadState, saveState, options } from './lib.mjs';
import { modeRules, plannerDone, bareAgentName, roleOfAgent } from './autopilot.mjs';

const input = readInput();
if (input.agent_id || !options().autopilot) pass(); // subagents cannot spawn agents anyway

const target = bareAgentName(input.tool_input?.subagent_type || 'general-purpose');
const role = roleOfAgent(target);
const writes = ['builder', 'refactorer', 'tester'].includes(role);
if (!writes) pass();

const state = loadState(input);
const task = state.task;
if (!task) pass();

if (task.mode === 'plan' || task.mode === 'review') {
  decide('deny', `This is a ${task.mode}-only request, so no code is written. Present the ${task.mode === 'plan' ? 'plan' : 'review'} and let the user decide.`);
}

const rules = modeRules(task.mode);
// A tester may write tests first (TDD) for a fix; building still needs the plan where required.
if (rules.plan && !plannerDone(state, task) && !(role === 'tester' && task.mode === 'fix')) {
  decide('deny', `Autopilot (${task.mode}): plan before building. Delegate to frontend-lead:frontend-architect first, then brief ${target} with the task, file scope and acceptance criteria from the plan.`);
}

if (rules.plan && options().planApproval && plannerDone(state, task) && !task.approved) {
  task.status = 'awaiting-approval';
  saveState(input, state);
  decide('deny', 'Plan approval is on: present the plan to the user and stop. Building starts after they reply.');
}

pass();
