---
description: Run every quality gate (lint, typecheck, tests, architecture, build, audit) and report pass/fail
---

Run the project's quality gates and report the result. Do not fix anything in this command.

Detect the package manager from the lockfile and use the scripts in `package.json`. Run whichever of these exist, in this order, and continue after a failure so the report is complete:

1. `lint`
2. `typecheck` (or `tsc --noEmit`)
3. `test` (with coverage if a `test:coverage` script exists)
4. `depcruise` (architecture rules)
5. `build`
6. `audit` for production dependencies (`npm audit --omit=dev` or the pnpm/yarn equivalent)

Report as a table: gate · result · key errors (first few lines) · owner role for the fix. End with **READY** or **NOT READY** and the shortest list of fixes needed. If a gate has no script, say so and suggest `/frontend-workflow:bootstrap`.
