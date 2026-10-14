---
name: feature-workflow
description: How the lead runs a change end to end - plan, delegate with strict briefs, test, verify, review, fix, report. Includes the delegation brief template, the review routing table and the final report template. Use when starting any feature, bug fix or refactor that touches more than a line or two.
---

# Lead workflow

You are the lead. Subagents do the scoped work; you own the plan, the order, the integration and the final call. Never mark something done that you have not verified.

## 0. Size the task

| Size | Example | Path |
|---|---|---|
| Tiny | typo, copy change, one obvious line | builder (or you, if strict delegation is off) → verify → code-reviewer |
| Small | one component or one bug with a clear cause | brief → builder → tester → verify → review |
| Medium/large | new feature, new route, cross-feature change | full pipeline below, with user approval of the plan |
| Unclear bug | cause unknown | debugger first, then the small path |

## 1. Understand
Restate the goal and acceptance criteria as testable bullets. Read the project `CLAUDE.md` and the affected code. Ask the user only about real ambiguities (one short question, with your recommended default).

## 2. Plan
Delegate to `frontend-architect` with the goal, criteria and known constraints. Check the plan against the standards yourself. For medium/large work, show the plan to the user and wait for approval before building.

## 3. Build (delegate with a strict brief)

Use this brief for every builder, tester or docs task:

```
TASK: <one sentence>
WHY: <the user-facing goal this serves>
SCOPE (only these files may change):
- <path>
- <path> (new)
CONTRACT: <types/props/function signatures to implement or respect>
ACCEPTANCE CRITERIA:
- <testable bullet>
CONSTRAINTS:
- follow frontend-lead:engineering-standards and the project CLAUDE.md
- <task-specific: reuse X, do not change Y, server component, etc.>
OUT OF SCOPE: <things not to touch even if tempting>
REPORT: use your role's report format
```

Rules:
- Order: types/contracts → services/server → hooks → components → route/page.
- Run tasks in parallel only when their scopes do not overlap.
- If a subagent reports BLOCKED or "needs change outside scope", decide: widen the scope in a new brief, assign it to another role, or ask the user. Never let a subagent decide that alone.
- Dependency needed? Run `dependency-manager` first, then ask the user to approve the install.
- Config or rules change needed (lint, TS, CI, package.json, CLAUDE.md)? Explain it to the user; only they can approve it.

## 4. Test
Delegate to `test-automator` with the acceptance criteria and the changed files. For clear behavior, do this before the build (TDD) and have the builder make the tests pass.

## 5. Verify
Lint, typecheck and tests must pass. Hooks run these automatically when subagents finish and when you finish; you can also run `/frontend-lead:ship-check`.

## 6. Review
Run `/frontend-lead:review`, or delegate directly using this routing table:

| Change touches | Reviewer |
|---|---|
| any code | code-reviewer |
| new files, folders, imports across features | architect-reviewer |
| forms, auth, user input, env vars, headers, server actions, API routes | security-auditor |
| UI, data fetching, images, fonts, client components, bundles | performance-engineer |
| any UI | accessibility-tester |
| public pages, routing, metadata, content | seo-specialist |
| package.json dependencies | dependency-manager |
| acceptance criteria / tests | qa-expert |
| always, last | surgeon-reviewer (ship / no-ship) |

Independent reviewers can run in parallel.

## 7. Fix
Send each BLOCKER/MAJOR finding to its owner with a new brief (scope = the files in the finding). Re-verify, then re-run only the reviewers whose area changed. MINOR findings: fix if cheap, otherwise list them as follow-ups. NITs: optional.

## 8. Report to the user

```
## Done: <task>
**What changed:** <2–5 bullets, user-facing first>
**Files:** <grouped by feature>
**Checks:** lint ✓ · typecheck ✓ · tests ✓ (<n> passed) · build <✓/not run>
**Reviews:** code ✓ · architecture ✓ · <others> · ship verdict: <PASS>
**Decisions & trade-offs:** <bullets>
**Follow-ups:** <MINOR findings, tech debt, open questions>
```

Do not commit or push unless the user asks. When they do, use a conventional commit message summarizing the change.
