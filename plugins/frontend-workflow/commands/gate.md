---
description: Non-interactive quality gate for git hooks and CI - checks + routed reviews on a diff, ends with a machine-readable verdict
argument-hint: <git range, e.g. origin/main...HEAD> (default: uncommitted changes)
---

You are running unattended (git hook or CI). Do not ask questions and do not change any files.

Scope: $ARGUMENTS
If no scope was given above, use the uncommitted changes (`git diff HEAD` plus untracked files).

1. List the changed files with `git diff --name-only <range>` and read the diff. If no source or test files changed, skip to step 5 with verdict SHIP.
2. Run the project's checks that exist in `package.json` (lint, typecheck, test, depcruise). Record pass/fail.
3. Pick reviewers with the routing table in the `frontend-workflow:feature-workflow` skill: always `code-reviewer`; add `architect-reviewer`, `security-auditor`, `performance-engineer`, `accessibility-tester`, `seo-specialist`, `dependency-manager`, `qa-expert` only when the changed files touch their area. Give each the exact file list and the diff range. Run them in parallel.
4. Run `surgeon-reviewer` last on the same scope.
5. Output a short report: a table of BLOCKER and MAJOR findings (file:line, finding, reviewer), failed checks, and at most 5 MINOR items. Then, as the very last line and with nothing after it, exactly one of:

FRONTEND-WORKFLOW VERDICT: SHIP
FRONTEND-WORKFLOW VERDICT: NO SHIP

The verdict is NO SHIP when any check failed or any BLOCKER or MAJOR finding exists.
