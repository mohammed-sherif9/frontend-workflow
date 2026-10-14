// Shared helpers for the frontend-lead hooks. Node 18+, no dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(HERE, '..', '..');
const IS_WIN = process.platform === 'win32';

// ---------- input / output ----------

export function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** PreToolUse decision. decision: 'deny' | 'ask' | 'allow' */
export function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: `[frontend-lead] ${reason}`,
      },
    }),
  );
  process.exit(0);
}

/** Stop / SubagentStop / PostToolUse: keep Claude working with feedback. */
export function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason: `[frontend-lead] ${reason}` }));
  process.exit(0);
}

export function pass() {
  process.exit(0);
}

// ---------- options ----------

function truthy(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

export function options() {
  const env = process.env;
  return {
    strictDelegation: truthy(env.CLAUDE_PLUGIN_OPTION_STRICT_DELEGATION ?? env.FRONTEND_LEAD_STRICT_DELEGATION, false),
    reviewGate: truthy(env.CLAUDE_PLUGIN_OPTION_REVIEW_GATE ?? env.FRONTEND_LEAD_REVIEW_GATE, true),
    verifyOnStop: truthy(env.CLAUDE_PLUGIN_OPTION_VERIFY_ON_STOP ?? env.FRONTEND_LEAD_VERIFY_ON_STOP, true),
    lintOnEdit: truthy(env.CLAUDE_PLUGIN_OPTION_LINT_ON_EDIT ?? env.FRONTEND_LEAD_LINT_ON_EDIT, true),
    autopilot: truthy(env.CLAUDE_PLUGIN_OPTION_AUTOPILOT ?? env.FRONTEND_LEAD_AUTOPILOT, true),
    planApproval: truthy(env.CLAUDE_PLUGIN_OPTION_PLAN_APPROVAL ?? env.FRONTEND_LEAD_PLAN_APPROVAL, true),
    approvalScope: String(env.CLAUDE_PLUGIN_OPTION_APPROVAL_SCOPE ?? env.FRONTEND_LEAD_APPROVAL_SCOPE ?? 'features-and-refactors').trim(),
    maxGateRounds: Math.max(1, Number(env.CLAUDE_PLUGIN_OPTION_MAX_GATE_ROUNDS ?? env.FRONTEND_LEAD_MAX_GATE_ROUNDS) || 8),
  };
}

// ---------- roles ----------

let CONFIG;
export function config() {
  if (!CONFIG) {
    const base = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'hooks', 'roles.json'), 'utf8'));
    // A project can extend or override the role map with .claude/frontend-lead.roles.json
    const projectFile = path.join(projectRoot({}), '.claude', 'frontend-lead.roles.json');
    if (fs.existsSync(projectFile)) {
      try {
        const extra = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
        base.agents = { ...base.agents, ...(extra.agents || {}) };
        base.roles = { ...base.roles, ...(extra.roles || {}) };
        for (const [k, v] of Object.entries(extra.paths || {})) base.paths[k] = [...(base.paths[k] || []), ...v];
        if (extra.unknownSubagentRole) base.unknownSubagentRole = extra.unknownSubagentRole;
        if (extra.autopilot) {
          const ap = base.autopilot;
          for (const [mode, rules] of Object.entries(extra.autopilot.modes || {})) {
            ap.modes[mode] = { ...(ap.modes[mode] || {}), ...rules };
          }
          for (const [intent, patterns] of Object.entries(extra.autopilot.intents || {})) {
            ap.intents[intent] = [...(ap.intents[intent] || []), ...patterns];
          }
          if (extra.autopilot.routing) ap.routing = [...ap.routing, ...extra.autopilot.routing];
        }
      } catch {
        /* ignore malformed project override */
      }
    }
    CONFIG = base;
  }
  return CONFIG;
}

/** Name without the plugin prefix: "frontend-lead:code-reviewer" -> "code-reviewer". */
export function bareAgentName(raw) {
  const s = String(raw || '');
  return s.includes(':') ? s.slice(s.lastIndexOf(':') + 1) : s;
}

export function roleOfAgent(name) {
  const cfg = config();
  return cfg.agents[bareAgentName(name)] || cfg.unknownSubagentRole || 'reviewer';
}

/** Returns { role, agent } for the current hook call. Main session = lead. */
export function resolveRole(input) {
  const cfg = config();
  const raw = input.agent_type || '';
  // Only treat it as a subagent when the hook fires inside one.
  if (!raw || !input.agent_id) return { role: 'lead', agent: 'lead' };
  const agent = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
  const role = cfg.agents[agent] || cfg.unknownSubagentRole || 'reviewer';
  return { role, agent };
}

export function roleRules(role) {
  const cfg = config();
  const rules = { ...(cfg.roles[role] || cfg.roles.reviewer) };
  if (role === 'lead' && options().strictDelegation) rules.write = cfg.strictDelegationLeadWrite || ['docs'];
  return rules;
}

// ---------- paths ----------

export function projectRoot(input) {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

export function relPath(input, file) {
  if (!file) return '';
  const root = projectRoot(input);
  const abs = path.isAbsolute(file) ? file : path.resolve(input.cwd || root, file);
  return path.relative(root, abs).split(path.sep).join('/');
}

function matchAny(list, rel) {
  return (list || []).some((re) => new RegExp(re).test(rel));
}

/** One category per path, in priority order. */
export function categorize(rel) {
  const p = config().paths;
  if (rel.startsWith('../')) return 'outside';
  if (matchAny(p.secret, rel)) return 'secret';
  if (matchAny(p.locked, rel)) return 'locked';
  if (matchAny(p.protected, rel)) return 'protected';
  if (matchAny(p.test, rel)) return 'test';
  if (matchAny(p.docs, rel)) return 'docs';
  if (matchAny(p.source, rel)) return 'source';
  return 'asset';
}

export const isCodeFile = (rel) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel);

// ---------- content checks ----------

function count(re, text) {
  if (!text) return 0;
  return (text.match(new RegExp(re, 'g')) || []).length;
}

/**
 * Collect the before/after text of a write tool call.
 * Only NEW occurrences of a banned pattern are reported, so untouched legacy code never blocks.
 */
export function writtenText(toolName, ti) {
  if (toolName === 'Write') return { before: '', after: ti.content || '' };
  if (toolName === 'Edit') return { before: ti.old_string || '', after: ti.new_string || '' };
  if (toolName === 'MultiEdit') {
    const edits = ti.edits || [];
    return {
      before: edits.map((e) => e.old_string || '').join('\n'),
      after: edits.map((e) => e.new_string || '').join('\n'),
    };
  }
  if (toolName === 'NotebookEdit') return { before: '', after: ti.new_source || '' };
  return { before: '', after: '' };
}

export function contentViolations(category, rel, before, after) {
  if (!isCodeFile(rel)) return [];
  const c = config().content;
  const groups = [...(c.code || [])];
  if (category === 'source') groups.push(...(c.source || []));
  if (category === 'test') groups.push(...(c.test || []));
  return groups.filter((rule) => count(rule.re, after) > count(rule.re, before));
}

// ---------- state (per session) ----------

function stateFile(input) {
  const dir = path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'frontend-lead'), 'state');
  fs.mkdirSync(dir, { recursive: true });
  const id = String(input.session_id || 'default').replace(/[^\w-]/g, '_');
  return path.join(dir, `${id}.json`);
}

export function loadState(input) {
  let s;
  try {
    s = JSON.parse(fs.readFileSync(stateFile(input), 'utf8'));
  } catch {
    s = {};
  }
  return {
    changes: [],
    events: [],
    created: {},
    deps: [],
    task: null,
    verifiedAt: 0,
    pendingNotice: null,
    ...s,
  };
}

export function saveState(input, state) {
  try {
    fs.writeFileSync(stateFile(input), JSON.stringify(state));
  } catch {
    /* state is best-effort */
  }
}

// ---------- running project tools ----------

export function findBin(root, name) {
  const file = path.join(root, 'node_modules', '.bin', IS_WIN ? `${name}.cmd` : name);
  return fs.existsSync(file) ? file : null;
}

export function readPkg(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function packageManager(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

export function run(cmd, args, cwd, timeoutMs = 240000) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: IS_WIN,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' },
    maxBuffer: 20 * 1024 * 1024,
  });
  // eslint-disable-next-line no-control-regex
  const output = `${r.stdout || ''}${r.stderr || ''}`.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').trim();
  return { ok: r.status === 0, status: r.status, output, timedOut: r.error?.code === 'ETIMEDOUT' };
}

export function tail(text, max = 3500) {
  if (!text) return '';
  return text.length > max ? `…(truncated)\n${text.slice(-max)}` : text;
}

/** Typecheck: prefer a "typecheck" script, else tsc --noEmit when a tsconfig exists. */
export function typecheck(root) {
  const pkg = readPkg(root);
  if (pkg?.scripts?.typecheck) return { name: 'typecheck', ...run(packageManager(root), ['run', 'typecheck'], root) };
  const tsc = findBin(root, 'tsc');
  if (tsc && fs.existsSync(path.join(root, 'tsconfig.json'))) {
    return { name: 'tsc --noEmit', ...run(tsc, ['--noEmit', '-p', 'tsconfig.json'], root) };
  }
  return null;
}

export function eslint(root, files, fix = false) {
  const bin = findBin(root, 'eslint');
  const existing = files.filter((f) => fs.existsSync(path.join(root, f)) && isCodeFile(f));
  if (!bin || existing.length === 0) return null;
  const flat = fs.readdirSync(root).some((f) => /^eslint\.config\.[cm]?[jt]s$/.test(f));
  const args = [...(fix ? ['--fix'] : []), ...(flat ? ['--no-warn-ignored'] : []), '--max-warnings', '0', ...existing];
  return { name: 'eslint', ...run(bin, args, root) };
}

export function relatedTests(root, files) {
  const existing = files.filter((f) => fs.existsSync(path.join(root, f)) && isCodeFile(f));
  if (existing.length === 0) return null;
  const vitest = findBin(root, 'vitest');
  if (vitest) return { name: 'vitest related', ...run(vitest, ['related', '--run', '--passWithNoTests', ...existing], root) };
  const jest = findBin(root, 'jest');
  if (jest) return { name: 'jest related', ...run(jest, ['--findRelatedTests', '--passWithNoTests', ...existing], root) };
  return null;
}

export function runTests(root, testFiles) {
  const existing = testFiles.filter((f) => fs.existsSync(path.join(root, f)));
  if (existing.length === 0) return null;
  // e2e specs need a running app; leave them to CI / the test-automator's own run.
  const unit = existing.filter((f) => !/(^|\/)e2e\//.test(f));
  if (unit.length === 0) return null;
  const vitest = findBin(root, 'vitest');
  if (vitest) return { name: 'vitest run', ...run(vitest, ['run', '--passWithNoTests', ...unit], root) };
  const jest = findBin(root, 'jest');
  if (jest) return { name: 'jest', ...run(jest, ['--passWithNoTests', ...unit], root) };
  return null;
}

export function summarize(results) {
  return results
    .filter(Boolean)
    .filter((r) => !r.ok)
    .map((r) => `### ${r.name} failed${r.timedOut ? ' (timed out)' : ''}\n${tail(r.output)}`)
    .join('\n\n');
}
