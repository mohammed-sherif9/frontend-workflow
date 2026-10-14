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

/** Does this mode require a plan from frontend-architect? */
export function planRequired(mode) {
  if (modeRules(mode).plan && CODE_MODES.includes(mode)) return true;
  // With approval scope "all-code-changes", fixes and changes are planned (and approved) too.
  return options().approvalScope === 'all-code-changes' && (mode === 'fix' || mode === 'change');
}

/** Does this mode require the user's explicit approval of the plan before any code is written? */
export function approvalRequired(mode) {
  return options().planApproval && planRequired(mode);
}

// Explicit answers to "do you approve this plan?" (English and Egyptian Arabic).
// `\b` does not work for Arabic letters in JS, so word ends are matched explicitly.
const END = '(?=$|[\\s,.!?:;،؛-])';
const APPROVE = new RegExp(`^\\s*(approved?|i approve|lgtm|looks good|go( ahead)?|proceed|start( building| work)?|ship it|yes|yep|yeah|ok(ay)?|sure|do it|confirm(ed)?|موافق|تمام|اوك|أوك|ماشي|يلا|إبدأ|ابدأ|ابدا|كمل|كمّل|نفذ|نفّذ|اعتمد|معتمد|اه|أه|ايوه|أيوه)${END}`, 'iu');
const REJECT = new RegExp(`^\\s*(no|nope|reject(ed)?|cancel|stop|abort|don'?t|never ?mind|forget it|لا|لأ|الغي|إلغي|الغاء|إلغاء|بلاش|وقف)${END}`, 'iu');

/**
 * Start a new task, or continue the open one.
 * While a plan is awaiting approval, only an explicit approval unlocks building;
 * anything else is treated as feedback on the plan (or a rejection).
 * Returns { task, continued, approval: 'approved' | 'feedback' | 'rejected' | null }.
 */
export function routeTask(state, input) {
  const prompt = String(input.prompt || '');
  const mode = classify(prompt);
  const now = Date.now();
  const open = state.task && state.task.status !== 'done' && CODE_MODES.includes(state.task.mode);

  if (open && state.task.status === 'awaiting-approval' && !prompt.trim().startsWith('/')) {
    const t = state.task;
    t.promptId = input.prompt_id || null;
    t.rounds = 0;
    if (APPROVE.test(prompt) && !REJECT.test(prompt)) {
      t.approved = true;
      t.approvedAt = now;
      t.status = 'active';
      const notes = prompt.replace(APPROVE, '').replace(/^[\s,.!?:;،؛-]+/u, '').trim();
      // Keep real instructions ("but name the route /deals"), drop filler ("please", "ابدأ").
      t.approvalNotes = notes && !/^(please|thanks|thank you|now)$/i.test(notes) && !APPROVE.test(notes) ? notes : null;
      return { task: t, continued: true, approval: 'approved' };
    }
    if (REJECT.test(prompt) && prompt.length < 120) {
      t.status = 'done';
      t.cancelled = true;
      return { task: t, continued: true, approval: 'rejected' };
    }
    t.feedback = prompt.slice(0, 2000);
    return { task: t, continued: true, approval: 'feedback' };
  }

  const followUp = ['none', 'question'].includes(mode) && prompt.length < 400;
  if (open && followUp) {
    const t = state.task;
    t.promptId = input.prompt_id || null;
    t.rounds = 0;
    return { task: t, continued: true, approval: null };
  }

  const task = {
    id: `${now}`,
    mode,
    promptId: input.prompt_id || null,
    startedAt: now,
    rounds: 0,
    approved: !approvalRequired(mode),
    status: CODE_MODES.includes(mode) ? 'active' : 'done',
  };
  state.task = task;
  return { task, continued: false, approval: null };
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

  if (planRequired(mode) && !events.some((e) => e.role === 'planner')) {
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

/** How Claude must present a plan for approval. */
export const APPROVAL_ASK = [
  'Present the plan to the user for approval, then STOP. Show it in full, not a summary: goal, acceptance criteria, files to create/change (tree), key types/contracts, server/client split, the task list with the owner role of each task, reviewers that will run, risks and open questions.',
  'End your message with exactly this line: **Reply "approve" to start building, or tell me what to change.**',
  'Do not delegate to builders, the tester or the refactorer and do not write code until the user approves; the hooks block it.',
].join('\n');

/** Text the router injects for a reply to a plan that is awaiting approval. */
export function approvalBrief(task, approval) {
  if (approval === 'approved') {
    return [
      `# frontend-lead autopilot: plan APPROVED by the user (${task.mode})`,
      'Building is unlocked. Continue the workflow from the build step: delegate tasks to their owner roles with strict briefs, then tests, verify, reviews and the final gate, and finish with the report.',
      task.approvalNotes ? `The user added these notes with the approval; apply them: "${task.approvalNotes}"` : '',
      'Stay inside the approved plan. If the work needs a significant change to the plan (new files outside its structure, a different approach, new dependencies), stop and ask the user before doing it.',
    ].filter(Boolean).join('\n\n');
  }
  if (approval === 'rejected') {
    return 'frontend-lead autopilot: the user REJECTED the plan. The task is cancelled. Acknowledge briefly, do not write or delegate any code, and ask whether they want a different approach.';
  }
  return [
    `# frontend-lead autopilot: plan still AWAITING APPROVAL (${task.mode})`,
    'The user replied with feedback or a question instead of approving.',
    '- If it is feedback on the plan: revise the plan (delegate to `frontend-lead:frontend-architect` again with the original goal, the current plan and this feedback, or adjust it yourself if the change is small), then present the full updated plan for approval.',
    '- If it is an unrelated question: answer it, then remind the user that the plan is waiting for their approval.',
    APPROVAL_ASK,
  ].join('\n');
}

/** Text the router injects so Claude runs the pipeline without being asked. */
export function pipelineBrief(task, continued) {
  const mode = task.mode;
  const opts = options();
  const needsApproval = approvalRequired(mode);
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
  lines.push(needsApproval
    ? 'Run this workflow automatically, without waiting for slash commands. It has ONE mandatory stop: after the plan, the user must approve it before any code is written. After approval, run every remaining step without stopping. Hooks block you if a step is skipped or out of order.'
    : 'Run the whole workflow below automatically, without waiting for slash commands. Do not stop between steps to ask permission unless a step says so. Hooks block you if a step is skipped or out of order.');
  const steps = [];
  steps.push('Understand: restate the goal + testable acceptance criteria (briefly, in your reply). Ask the user only if something is genuinely ambiguous.');
  if (planRequired(mode)) {
    steps.push('Plan: delegate to `frontend-lead:frontend-architect`, then check the plan against the standards yourself.' + (needsApproval
      ? ` Then get approval:\n${APPROVAL_ASK.split('\n').map((l) => `   ${l}`).join('\n')}`
      : ' Continue straight to building.'));
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
