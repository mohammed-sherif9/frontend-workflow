---
description: Fix a bug the lead way - diagnose, regression test, minimal fix, verify, review
argument-hint: <bug description, error message or failing behavior>
---

Fix this bug:

$ARGUMENTS

1. If the cause is not obvious from one read of the code, delegate to `debugger` to find the root cause with evidence. Do not guess.
2. Delegate a **regression test that fails now** to `test-automator`.
3. Delegate the **minimal fix** to the owning builder (scope = only the files the root cause requires). No unrelated refactors.
4. Confirm the regression test now passes and lint, typecheck and the related tests pass.
5. Review with `code-reviewer`, plus `security-auditor` if the bug involved input, auth or data exposure, and `surgeon-reviewer` last.
6. Report: root cause, fix, test added, checks, review verdicts. Do not commit.
