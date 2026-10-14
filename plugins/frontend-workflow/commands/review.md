---
description: Review the current changes with the right reviewer subagents and give a ship / no-ship verdict
argument-hint: [optional scope, e.g. a path, branch or "staged"]
---

Review the current change set. Scope: $ARGUMENTS

If no scope was given above, the scope is all uncommitted changes (`git diff HEAD` plus untracked files).

1. Run `git status` and `git diff --stat` to see what changed, and group the files by area.
2. Choose reviewers with the routing table in the `frontend-workflow:feature-workflow` skill. Always include `code-reviewer` and `architect-reviewer`. Add `security-auditor`, `performance-engineer`, `accessibility-tester`, `seo-specialist`, `dependency-manager` and `qa-expert` only when the change touches their area.
3. Give every reviewer the same brief: the scope (exact file list), what the change is meant to do, and "report with your role's format". Run independent reviewers in parallel.
4. Then run `surgeon-reviewer` last on the same scope for the ship / no-ship verdict.
5. Merge the results into one table, deduplicated and sorted by severity:

| Severity | File:line | Finding | Owner | Reviewer |
|---|---|---|---|---|

6. Final verdict: **SHIP** only when there are no BLOCKER or MAJOR findings. Otherwise **NO SHIP**, with the list of fixes to delegate. Ask me whether to start the fixes.
