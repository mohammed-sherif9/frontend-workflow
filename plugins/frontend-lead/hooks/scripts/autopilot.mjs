// Autopilot logic shared by the router (UserPromptSubmit), the Agent guard and the Stop gate.
// A "task" spans one user request and its follow-ups (answers to questions, plan approval).
import { config, options, bareAgentName, roleOfAgent, categorize } from './lib.mjs';

export const CODE_MODES = ['feature', 'refactor', 'fix', 'change', 'quick'];

const SLASH_MODES = {
  feature: 'feature',
  fix: 'fix',
  plan: 'plan',
  review: 'review',
  'ship-check': 'review',
  gate: 'review',
  bootstrap: 'setup',
  roles: 'none',
};

function test(patterns, text) {
  return (patterns || []).some((p) => new RegExp(p, 'iu').test(text));
}

/** Decide what kind of request this prompt is. */
export function classify(prompt) {
  const text = String(prompt || '').trim();
  if (!text) return 'none';
  if (/#no-?workflow\b/i.test(text)) return 'off';
  if (/^(quick:|#quick\b)|\s#quick\b/i.test(text)) return 'quick';

  const slash = text.match(/^\/(?:frontend-lead:)?([\w-]+)/);
  if (slash) {
    if (text.startsWith('/frontend-lead:') || SLASH_MODES[slash[1]]) return SLASH_MODES[slash[1]] || 'none';
    return 'none'; // someone else's command: don't guess
  }

  const intents = config().autopilot.intents;
  const politeRequest = /^(can|could|would|will) you\b|\bplease\b/i.test(text);
  if (!politeRequest && test(intents.question, text)) return 'question';
  if (test(intents.fix, text)) return 'fix';
  if (test(intents.refactor, text)) return 'refactor';
  if (test(intents.feature, text)) return 'feature';
  // Long, multi-requirement requests are features even without trigger words.
  if (text.length > 450 && (text.match(/\n\s*[-*\d]/g) || []).length >= 3) return 'feature';
  if (test(intents.change, text)) return 'change';
  return 'none';
}

export function modeRules(mode) {
  const modes = config().autopilot.modes;
  if (modes[mode]) return modes[mode];
  // Unclassified requests that still change code are treated as a "change".
  return modes.change;
}

/** Start a new task, or continue the open one when the user is just answering or approving. */
export function routeTask(state, input) {
  const mode = classify(input.prompt);
  const now = Date.now();
  const open = state.task && state.task.status !== 'done' && CODE_MODES.includes(state.task.mode);
  const followUp = ['none', 'question'].includes(mode) && String(input.prompt || '').length < 400;

  if (open && followUp) {
    const t = state.task;
    t.promptId = input.prompt_id || null;
    t.rounds = 0;
    if (t.status === 'awaiting-approval') {
      t.approved = true;
      t.status = 'active';
    }
    return { task: t, continued: true };
  }

  const task = {
    id: `${now}`,
    mode,
    promptId: input.prompt_id || null,
    startedAt: now,
    rounds: 0,
    approved: !options().planApproval,
    status: CODE_MODES.includes(mode) ? 'active' : 'done',
  };
  state.task = task;
  return { task, continued: false };
}

export function taskEvents(state, task) {
  return (state.events || []).filter((e) => e.at >= (task?.startedAt || 0));
}

export function taskChanges(state, task) {
  return (state.changes || []).filter((c) => c.at >= (task?.startedAt || 0));
}

export function plannerDone(state, task) {
  return taskEvents(state, task).some((e) => e.role === 'planner');
}

/** Reviewers required for this task: mode defaults + routing by changed files. */
export function requiredReviewers(state, task) {
  const mode = task?.mode || 'change';
  const rules = modeRules(mode);
  const changes = taskChanges(state, task);
  const files = [...new Set(changes.map((c) => c.file))];
  const created = Object.entries(state.created || {})
    .filter(([, at]) => at >= (task?.startedAt || 0))
    .map(([f]) => f);
  const depsChanged = (state.deps || []).some((d) => d.at >= (task?.startedAt || 0));
  const set = new Set(rules.reviewers || []);
  if (!rules.noRouting) {
    for (const r of config().autopilot.routing || []) {
      if (r.modes && !r.modes.includes(mode)) continue;
      const re = new RegExp(r.files, 'i');
      const hit =
        files.some((f) => re.test(f)) ||
        (r.orCreatedFiles && created.some((f) => categorize(f) === 'source')) ||
        (r.orDependencyChange && depsChanged);
      if (hit) set.add(r.agent);
    }
  }
  if (rules.final) set.delete(rules.final);
  return [...set];
}

/**
 * The ordered list of workflow steps still missing for the current task.
 * Returns { steps: [...], needsVerify: boolean, lastCodeAt }.
 */
export function missingSteps(state, task) {
  const mode = task?.mode || 'none';
  const rules = modeRules(mode);
  const changes = taskChanges(state, task);
  const code = changes.filter((c) => c.category === 'source' || c.category === 'test');
  if (code.length === 0) return { steps: [], needsVerify: false, lastCodeAt: 0 };

  const events = taskEvents(state, task);
  const lastCodeAt = Math.max(...code.map((c) => c.at));
  const source = code.filter((c) => c.category === 'source');
  const lastSourceAt = source.length ? Math.max(...source.map((c) => c.at)) : 0;
  const ranAfter = (agent, at) => events.some((e) => e.agent === agent && e.at > at);
  const steps = [];

  if (rules.plan && !events.some((e) => e.role === 'planner')) {
    steps.push({ id: 'plan', text: 'Plan the change: delegate to `frontend-lead:frontend-architect` (it should also check what was already built).' });
  }

  const created = Object.entries(state.created || {})
    .filter(([f, at]) => at >= (task?.startedAt || 0) && categorize(f) === 'source');
  const testsNeeded =
    source.length > 0 &&
    (rules.tests === 'always' || (rules.tests === 'new-files' && created.length > 0));
  if (testsNeeded && !events.some((e) => e.role === 'tester' && e.at > lastSourceAt)) {
    const why = mode === 'fix' ? 'a regression test that fails without the fix' : 'tests for the new/changed behavior';
    steps.push({ id: 'tests', text: `Tests: delegate ${why} to \`frontend-lead:test-automator\` (scope: the changed files).` });
  }

  const reviewers = requiredReviewers(state, task);
  const missingReviewers = reviewers.filter((r) => !ranAfter(r, lastCodeAt));
  const needsVerify = (state.verifiedAt || 0) < lastCodeAt;

  if (missingReviewers.length) {
    steps.push({
      id: 'review',
      text: `Review (run these in parallel, same file scope): ${missingReviewers.map((r) => `\`frontend-lead:${r}\``).join(', ')}. Send every BLOCKER/MAJOR finding back to its owner role, then re-run that reviewer.`,
    });
  }

  if (rules.final) {
    const lastOtherReview = Math.max(lastCodeAt, ...events.filter((e) => reviewers.includes(e.agent)).map((e) => e.at));
    if (!ranAfter(rules.final, lastOtherReview)) {
      steps.push({ id: 'final', text: `Final gate: \`frontend-lead:${rules.final}\` for the ship / no-ship verdict, after all other reviews and fixes.` });
    }
  }

  return { steps, needsVerify, lastCodeAt, reviewers };
}

/** Text the router injects so Claude runs the pipeline without being asked. */
export function pipelineBrief(task, continued) {
  const mode = task.mode;
  const opts = options();
  if (mode === 'off') return 'frontend-lead autopilot is OFF for this request (#no-workflow). Role guards still apply.';
  if (mode === 'plan') return 'frontend-lead autopilot: PLAN-ONLY request. Delegate to frontend-lead:frontend-architect, review the plan, present it. Do not write or delegate any code.';
  if (mode === 'review') return 'frontend-lead autopilot: REVIEW-ONLY request. Run the reviewers and report. Do not change code unless the user asks.';
  if (mode === 'setup') return 'frontend-lead autopilot: SETUP request. Follow the bootstrap-project skill. Config changes need the user\'s approval.';
  if (!CODE_MODES.includes(mode)) {
    return 'frontend-lead autopilot: no code task detected. Answer normally. If this turns into a code change, delegate it to the right role; the workflow gates apply to any code change.';
  }

  const r = modeRules(mode);
  const lines = [];
  lines.push(`# frontend-lead autopilot: ${mode.toUpperCase()} ${continued ? '(continuing the open task)' : ''}`.trim());
  lines.push('Run the whole workflow below automatically, without waiting for slash commands. Do not stop between steps to ask permission unless a step says so. Hooks block you if a step is skipped or out of order.');
  const steps = [];
  steps.push('Understand: restate the goal + testable acceptance criteria (briefly, in your reply). Ask the user only if something is genuinely ambiguous.');
  if (r.plan) {
    steps.push('Plan: delegate to `frontend-lead:frontend-architect`.' + (opts.planApproval
      ? ' Then show the plan and STOP for the user\'s approval (builders are blocked until they reply).'
      : ' Check the plan against the standards and continue straight to building.'));
  }
  if (mode === 'fix') steps.push('Diagnose: if the cause is not obvious, delegate to `frontend-lead:debugger` first.');
  if (r.tests === 'always') steps.push(mode === 'fix'
    ? 'Regression test: delegate to `frontend-lead:test-automator` (a test that fails now).'
    : 'Tests: delegate to `frontend-lead:test-automator` (before the build for TDD when behavior is clear, otherwise right after).');
  steps.push(r.leadWritesCode
    ? 'Build: you may make this small change yourself.'
    : 'Build: delegate each task to its owner role with a strict brief (goal, exact file scope, acceptance criteria). Builders: `nextjs-developer` (routes, server, metadata), `react-specialist` (components, hooks), `typescript-pro` (types, schemas, shared libs)' + (mode === 'refactor' ? ', `refactoring-specialist` (behavior-preserving changes)' : '') + '. You do not write production code or tests yourself in this mode.');
  if (r.tests === 'new-files') steps.push('Tests: if new source files or new behavior are added, delegate tests to `frontend-lead:test-automator`.');
  steps.push('Verify: lint, typecheck and related tests must pass (run automatically when you finish; fix failures through the owning role).');
  const reviewers = [...(r.reviewers || [])];
  steps.push(`Review: ${reviewers.map((x) => `\`${x}\``).join(', ')}${r.noRouting ? '' : ' + the specialists the hooks add from the changed files (accessibility, performance, SEO, security, architecture, dependencies)'}. Fix BLOCKER/MAJOR findings through the owner role.`);
  if (r.final) steps.push(`Final gate: \`${r.final}\` last.`);
  if (r.docs) steps.push('Docs: if setup, public APIs or behavior users/devs rely on changed, delegate to `documentation-engineer`.');
  steps.push('Report with the feature-workflow report template. Do not commit unless asked.');
  lines.push(steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  lines.push('Load the `frontend-lead:feature-workflow` skill for the brief and report templates, and `frontend-lead:engineering-standards` for the rules. Tiny edits: the user can prefix a request with "quick:"; to bypass the workflow: "#no-workflow".');
  return lines.join('\n\n');
}

export { bareAgentName, roleOfAgent };
