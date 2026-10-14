#!/usr/bin/env node
// frontend-lead: AI review gate for code you change by hand.
// Copy to <project>/scripts/claude-gate.mjs and call it from .husky/pre-push:
//   node scripts/claude-gate.mjs
// It runs Claude Code headless with the frontend-lead plugin on the commits you are about to push,
// prints the review, and blocks the push on "NO SHIP".
//
// Skip once:            SKIP_CLAUDE_GATE=1 git push
// Report only (no block): CLAUDE_GATE_MODE=warn git push
// Compare against:      CLAUDE_GATE_BASE=origin/develop git push   (default: upstream or origin/main)
import { spawnSync } from 'node:child_process';

const env = process.env;
const mode = env.CLAUDE_GATE_MODE || 'block';
const log = (m) => process.stderr.write(`[claude-gate] ${m}\n`);

if (env.SKIP_CLAUDE_GATE === '1') {
  log('skipped (SKIP_CLAUDE_GATE=1)');
  process.exit(0);
}

const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });

if (sh('claude', ['--version']).status !== 0) {
  log('Claude Code CLI not found; skipping the AI review. Install it to enable the gate.');
  process.exit(0);
}

function baseRef() {
  if (env.CLAUDE_GATE_BASE) return env.CLAUDE_GATE_BASE;
  const upstream = sh('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.status === 0 && upstream.stdout.trim()) return upstream.stdout.trim();
  return 'origin/main';
}

const range = `${baseRef()}...HEAD`;
const changed = sh('git', ['diff', '--name-only', range]);
const files = changed.status === 0 ? changed.stdout.split('\n').filter(Boolean) : [];
const code = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|css|scss)$/.test(f));
if (changed.status === 0 && code.length === 0) {
  log(`no code changes in ${range}; nothing to review.`);
  process.exit(0);
}

log(`reviewing ${code.length || 'changed'} file(s) in ${range} … (this takes a few minutes)`);
// Bash is allowed broadly: the frontend-lead hooks make the shell read-only for this review-only run
// (no file writes, no git changes, no installs, no reading .env).
const allowed = ['Agent', 'Read', 'Grep', 'Glob', 'Bash'];

// Extra CLI args, e.g. CLAUDE_GATE_ARGS="--model sonnet" or "--plugin-dir /path/to/plugin"
const extra = (env.CLAUDE_GATE_ARGS || '').split(' ').filter(Boolean);
const run = spawnSync(
  'claude',
  // Each tool pattern is its own argument so patterns containing spaces stay intact.
  ['-p', `/frontend-lead:gate ${range}`, '--permission-mode', 'dontAsk', ...extra, '--allowedTools', ...allowed],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32', maxBuffer: 50 * 1024 * 1024 },
);

const out = (run.stdout || '').trim();
process.stdout.write(`${out}\n`);

const verdict = out.match(/FRONTEND-LEAD VERDICT:\s*(SHIP|NO SHIP)\s*$/);
if (!verdict) {
  log('could not read a verdict from the review; not blocking.');
  process.exit(0);
}
if (verdict[1] === 'NO SHIP') {
  if (mode === 'warn') {
    log('NO SHIP (warn mode: push continues).');
    process.exit(0);
  }
  log('NO SHIP: push blocked. Fix the findings, or push with SKIP_CLAUDE_GATE=1 if you accept the risk.');
  process.exit(1);
}
log('SHIP');
process.exit(0);
