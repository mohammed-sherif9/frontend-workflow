# frontend-lead workflow

A reusable Claude Code plugin that makes Claude work like a **lead frontend engineer** on Next.js / React / TypeScript / Tailwind projects: it plans, delegates to specialist subagents with strict roles, verifies, gets the work reviewed, and only then reports done.

Role boundaries are not just instructions. They are **enforced by hooks**: a reviewer cannot edit files, a builder cannot touch tests or configs, nobody can read `.env`, and the lead cannot finish while checks fail or before a review.

Subagents are adapted from [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (MIT, commit `408d3c9`), with role contracts, report formats and tool restrictions added.

---

## Folder structure

```
frontend-lead-workflow/                 ← git repo = marketplace
├── .claude-plugin/marketplace.json
└── plugins/frontend-lead/              ← the plugin
    ├── .claude-plugin/plugin.json      ← metadata + settings (strict delegation, gates)
    ├── agents/                         ← 17 subagents (16 adapted + 1 custom planner)
    ├── skills/
    │   ├── engineering-standards/      ← the standards + 8 reference checklists
    │   ├── feature-workflow/           ← the lead pipeline, brief + report templates
    │   └── bootstrap-project/          ← set up a project's tooling from templates
    ├── commands/                       ← /frontend-lead:feature, plan, fix, review, ship-check, bootstrap, roles
    ├── hooks/
    │   ├── hooks.json                  ← wiring
    │   ├── roles.json                  ← who may write what (editable)
    │   └── scripts/*.mjs               ← the enforcement (Node, no dependencies)
    └── templates/                      ← project files: CLAUDE.md, ESLint, TS, Vitest, Playwright,
                                          dependency-cruiser, Lighthouse CI, Husky, CI, security headers
```

## The roles

| Role | Agents | May write | Shell |
|---|---|---|---|
| **Lead** | you + the main session | everything (or docs only with strict delegation) | git & dependency changes need your approval |
| **Planner** | `frontend-architect` | nothing | none |
| **Builder** | `nextjs-developer`, `react-specialist`, `typescript-pro` | production code & assets | scripts only; no git, no deps |
| **Refactorer** | `refactoring-specialist` | production code; tests must pass unchanged | scripts only |
| **Tester** | `test-automator` | test files only | scripts only |
| **Docs** | `documentation-engineer` | `.md` / `.mdx` / `docs/` only | none |
| **Reviewers** | `code-reviewer`, `surgeon-reviewer`, `architect-reviewer`, `security-auditor`, `performance-engineer`, `accessibility-tester`, `seo-specialist`, `dependency-manager`, `qa-expert` | nothing | read-only checks |
| **Investigator** | `debugger` | nothing | read-only checks |

Any other subagent (built-in `general-purpose`, other plugins) is treated as a read-only reviewer, so it cannot bypass the roles.

## What the hooks enforce

| When | Rule |
|---|---|
| Every read | `.env*` (except `.env.example`), keys and certificates cannot be read |
| Every write | role may only write its own file types; lockfiles and build output are never hand-edited; lint/TS/test/CI configs, `package.json`, `CLAUDE.md` and `.claude/` need **your** approval (subagents are blocked) |
| Every write | new `any`, `@ts-ignore`/`@ts-expect-error`, `eslint-disable`, `debugger`, `console.log`, `eval`, `NEXT_PUBLIC_*SECRET`, `.only`/`.skip` are blocked; `dangerouslySetInnerHTML` asks you. Existing legacy code is never blocked, only new occurrences |
| Every shell command | blocked for everyone: `--no-verify`, force push, publish, `curl | sh`, reading `.env`, dumping env. Read-only roles cannot write files, change git or install. Builders cannot commit or install. The lead is asked before installs, push, `reset --hard`, `rm -r` |
| After every edit | Prettier + `eslint --fix`; remaining lint errors go straight back to the agent |
| Builder / tester finishes | its own files must pass lint + typecheck (builder) or its tests must pass (tester) |
| Lead finishes | typecheck + lint + related tests on all changed files must pass, and a reviewer must have run after the last change |

## Install

**1. Put this folder in a git repo** (GitHub, GitLab…), e.g. `YOUR-USER/frontend-lead-workflow`.

**2. In Claude Code:**
```
/plugin marketplace add YOUR-USER/frontend-lead-workflow
/plugin install frontend-lead@mohamed-frontend
```
To try it locally first: `/plugin marketplace add /path/to/frontend-lead-workflow`, or start Claude with `claude --plugin-dir /path/to/frontend-lead-workflow/plugins/frontend-lead`.

**3. Per project (optional but recommended):** run `/frontend-lead:bootstrap`. It writes a project `CLAUDE.md`, strict tooling and CI from `templates/`, and `.claude/settings.json` so teammates get the plugin automatically.

Requirements: Node 18+ (the hooks are plain Node scripts). The verify gates use the project's own `node_modules/.bin` (eslint, tsc, vitest/jest, prettier); missing tools are skipped, not installed.

## Daily use

| Command | What it does |
|---|---|
| `/frontend-lead:feature <request>` | full pipeline: plan → your approval → build → test → verify → review → fix → report |
| `/frontend-lead:plan <request>` | plan only |
| `/frontend-lead:fix <bug>` | debugger → regression test → minimal fix → review |
| `/frontend-lead:review [scope]` | routes the change to the right reviewers, ship / no-ship verdict |
| `/frontend-lead:ship-check` | runs every gate and reports READY / NOT READY |
| `/frontend-lead:bootstrap` | sets up a project for this workflow |
| `/frontend-lead:roles` | shows the role matrix and current settings |

You can also just talk normally; the session-start context tells Claude it is the lead and how the pipeline works.

## Settings

Change in `/plugin` → frontend-lead → configure:

| Setting | Default | Effect |
|---|---|---|
| `strict_delegation` | off | on = the lead may only write docs; all code goes through subagents |
| `review_gate` | on | lead cannot finish until a reviewer ran after the last code change |
| `verify_on_stop` | on | lead cannot finish while typecheck / lint / related tests fail |
| `lint_on_edit` | on | Prettier + ESLint on every edit |

The gates block once per turn (they never trap Claude in a loop). If you deliberately want to skip a review, say so and Claude will note it in its report.

## Per-project overrides

Create `<project>/.claude/frontend-lead.roles.json` to add agents, change a role, or add path patterns, for example a project-specific agent or a `src/legacy/` folder treated as protected:

```json
{
  "agents": { "ecral-booking-expert": "builder" },
  "paths": { "protected": ["^src/legacy/"] }
}
```

## Adding more agents from the VoltAgent repo

1. Copy the agent file into `plugins/frontend-lead/agents/`.
2. Set its `tools` / `disallowedTools` to match a role (reviewers: `Read, Grep, Glob, Bash`, never `Write`/`Edit`).
3. Add it to `hooks/roles.json` → `agents` with its role. Until you do, it is treated as a read-only reviewer.
4. Read the whole file first: agent files steer Claude in your codebase.

Good candidates for later: `ui-designer`, `ui-ux-tester` (needs the Chrome tools), `build-engineer`, `git-workflow-manager`.

## Known limits

- Hooks guard the tools, not every possible trick: a determined agent could still write a file with `node -e` from a builder's shell. The agents' contracts forbid it and read-only roles have such commands blocked, but reviews remain the final safety net.
- Plugin subagents ignore per-agent `hooks` and `permissionMode` fields, which is why all enforcement lives in the plugin-level hooks keyed on the subagent's name.
- The ESLint template targets Next.js 16+ (flat `eslint-config-next`); for Next 15 use `FlatCompat` with `next/core-web-vitals`.
