// UserPromptSubmit: classify every request and inject the matching pipeline, so the workflow
// starts by itself for features, refactors, fixes and code changes. While a plan waits for
// approval, the user's reply decides: explicit approval unlocks building, anything else revises.
import { readInput, loadState, saveState, options, projectRoot } from './lib.mjs';
import { routeTask, pipelineBrief, approvalBrief } from './autopilot.mjs';
import fs from 'node:fs';
import path from 'node:path';

const MAX_SPEC_CHARS = 30000;

/**
 * A request that names a spec file (specs/<feature>/spec.md) is built from that file.
 * Read it here so the planner and QA get the real acceptance criteria, not a paraphrase.
 */
export function specBrief(prompt, root, task) {
  const match = String(prompt || '').match(/(?:^|[\s`'"(])((?:[\w.-]+\/)*specs\/[\w.-]+\/spec\.md)(?=$|[\s`'")\],.;:])/);
  if (!match) return '';
  const rel = match[1];
  const abs = path.resolve(root, rel);
  const inside = abs === root || abs.startsWith(root + path.sep);
  if (!inside || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return `Note from frontend-lead: the request names \`${rel}\`, but that file was not found under the project root. Ask the user for the spec or the correct path before planning.`;
  }
  // Send the full spec once per task; later prompts in the same task only need the path.
  if (task) {
    task.specsSent = task.specsSent || [];
    if (task.specsSent.includes(rel)) return `The spec \`${rel}\` was sent earlier in this task and is still the source of truth. Re-read it if you need the exact criteria.`;
    task.specsSent.push(rel);
  }
  let text = fs.readFileSync(abs, 'utf8');
  const truncated = text.length > MAX_SPEC_CHARS;
  if (truncated) text = text.slice(0, MAX_SPEC_CHARS);
  const lines = [
    `# Spec file: ${rel}`,
    'This spec is the source of truth for the feature. Rules:',
    '- frontend-architect: plan against this spec. Every acceptance criterion maps to a file, contract or task in the plan.',
    '- Every acceptance criterion needs at least one test (test-automator). Name the test after the criterion, or list the criterion in the test file.',
    '- qa-expert: check each acceptance criterion against the spec and the tests. Report any criterion with no test or no implementation as a BLOCKER.',
    '- If the spec and the code disagree, stop and ask the user. Do not silently change the spec.',
    '',
    '```markdown',
    text,
    '```',
  ];
  if (truncated) lines.push(`(The spec was truncated at ${MAX_SPEC_CHARS} characters; read the rest of \`${rel}\` before planning.)`);
  return lines.join('\n');
}

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
const spec = specBrief(input.prompt, projectRoot(input), task);
if (spec) parts.push(spec);

// The full pipeline is sent once per task. Follow-ups in the same task get a short reminder;
// the hooks still enforce every step.
if (approval) {
  parts.push(approvalBrief(task, approval));
} else if (continued && task.pipelineSent) {
  parts.push(`frontend-lead autopilot: continuing the open ${task.mode} task. The workflow steps and any spec from the start of this task still apply, and the hooks still block missing steps. Do the remaining steps before finishing.`);
} else {
  parts.push(pipelineBrief(task, continued));
  task.pipelineSent = true;
}
saveState(input, state);

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: parts.join('\n\n') } }),
);
