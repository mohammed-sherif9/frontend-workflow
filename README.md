# frontend-lead workflow

A reusable Claude Code plugin that makes Claude work like a **lead frontend engineer** on Next.js / React / TypeScript / Tailwind projects: it plans, delegates to specialist subagents with strict roles, verifies, gets the work reviewed, and only then reports done.

Role boundaries are not just instructions. They are **enforced by hooks**: a reviewer cannot edit files, a builder cannot touch tests or configs, nobody can read `.env`, and the lead cannot finish while checks fail or before a review.

Subagents are adapted from [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (MIT, commit `408d3c9`), with role contracts, report formats and tool restrictions added.

---

## Autopilot: the workflow runs by itself

You don't need slash commands. Just ask normally ("add a booking summary to the car page", "the checkout button is broken on mobile", "refactor the fleet filters", "غير لون الزرار"). Every request is classified, and the matching pipeline runs automatically:

| You ask for… | Detected as | What runs automatically |
|---|---|---|
| a new page, component, flow, form, filter… | **feature** | plan (`frontend-architect`) → build (builders) → tests (`test-automator`) → verify → `code-reviewer`, `architect-reviewer`, `qa-expert` + routed specialists → `surgeon-reviewer` → report |
| refactor / clean up / restructure / rename | **refactor** | plan → `refactoring-specialist` / builders → verify (existing tests must still pass) → code + architecture review → `surgeon-reviewer` |
| fix / bug / broken / error | **fix** | `debugger` if unclear → regression test → minimal fix → verify → `code-reviewer` → `surgeon-reviewer` |
| change / update / style / move / add a small thing | **change** | builder → tests if new files were created → verify → `code-reviewer` + routed specialists |
| `quick: …` | **quick** | Claude may edit directly → verify → `code-reviewer` |
| a question | **question** | normal answer; if it turns into a code change, the workflow kicks in |
| `… #no-workflow` | **off** | no workflow for this request (role guards still apply) |

**Specialist reviewers are added automatically from the files that changed:** `.tsx` → accessibility; pages, layouts, `next.config` → performance; `page`/`layout`/`sitemap`/`robots`/metadata → SEO; `api`, `server`, actions, auth, middleware, env, forms → security; new files or `index.ts` → architecture; dependency changes → `dependency-manager`.

**The order is enforced, not suggested:**
- builders are blocked until the plan exists (features and refactors);
- the lead is blocked from writing production code or tests itself in a workflow task: it must delegate to the owning role;
- Claude cannot finish while a required step is missing. The Stop hook sends it back with the exact remaining steps, in order, as many times as needed (up to `max_gate_rounds`, then the open steps are reported to you on the next message);
- follow-up messages ("yes", "go ahead", answers to its questions) continue the same task instead of starting a new one.

Tested live: a plain request ("Add a formatPrice helper…") made Claude delegate to `typescript-pro`, then `test-automator`, then `code-reviewer`. It tried to finish, the gate sent it back for the architecture review a new file requires, it ran `architect-reviewer`, and then reported.

### Code you change yourself

The autopilot covers work Claude does. For code you write by hand, two automatic gates run the same review:

- **On `git push`**: `scripts/claude-gate.mjs` (installed by `/frontend-lead:bootstrap`, called from `.husky/pre-push`) runs `/frontend-lead:gate` headless on the commits being pushed: checks + routed reviewers + `surgeon-reviewer`, and **blocks the push on NO SHIP**. `CLAUDE_GATE_MODE=warn` reports without blocking; `SKIP_CLAUDE_GATE=1 git push` skips once.
- **On every pull request**: `.github/workflows/claude-pr-review.yml` runs the same gate in GitHub Actions and posts the report as a PR comment.

During these unattended runs the hooks make the shell read-only, so the reviewer can run checks but cannot change files, git state or dependencies.

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

## Commands (optional with autopilot on)

Just talking to Claude is enough. The commands are for when you want to force a specific path:

| Command | What it does |
|---|---|
| `/frontend-lead:gate [range]` | unattended review used by the git hook and the PR workflow; ends with `FRONTEND-LEAD VERDICT: SHIP` or `NO SHIP` |
| `/frontend-lead:feature <request>` | full pipeline: plan → your approval → build → test → verify → review → fix → report |
| `/frontend-lead:plan <request>` | plan only |
| `/frontend-lead:fix <bug>` | debugger → regression test → minimal fix → review |
| `/frontend-lead:review [scope]` | routes the change to the right reviewers, ship / no-ship verdict |
| `/frontend-lead:ship-check` | runs every gate and reports READY / NOT READY |
| `/frontend-lead:bootstrap` | sets up a project for this workflow |
| `/frontend-lead:roles` | shows the role matrix and current settings |


## Settings

Change in `/plugin` → frontend-lead → configure:

| Setting | Default | Effect |
|---|---|---|
| `autopilot` | on | classify every request and run its workflow automatically |
| `plan_approval` | off | on = for features/refactors Claude stops after the plan and waits for your "go ahead" before building |
| `max_gate_rounds` | 8 | how many times per task the gates can send Claude back before reporting the open steps to you |
| `strict_delegation` | off | on = the lead may only write docs; all code goes through subagents |
| `review_gate` | on | lead cannot finish until a reviewer ran after the last code change |
| `verify_on_stop` | on | lead cannot finish while typecheck / lint / related tests fail |
| `lint_on_edit` | on | Prettier + ESLint on every edit |

The gates send Claude back as many times as needed to finish the workflow, up to `max_gate_rounds` per task, so they can never trap it in an endless loop. To skip the workflow for one request, add `#no-workflow`; for a tiny edit, start with `quick:`.

## Per-project overrides

Create `<project>/.claude/frontend-lead.roles.json` to add agents, change a role, or add path patterns, for example a project-specific agent or a `src/legacy/` folder treated as protected:

```json
{
  "agents": { "ecral-booking-expert": "builder" },
  "paths": { "protected": ["^src/legacy/"] }
}
```

The same file can tune the autopilot per project: change what a mode requires, add trigger words, or route extra reviewers:

```json
{
  "autopilot": {
    "modes": { "change": { "tests": "always" } },
    "intents": { "feature": ["\\b(landing page|campaign)\\b"] },
    "routing": [{ "agent": "seo-specialist", "files": "(^|/)features/(offers|blog)/" }]
  }
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
