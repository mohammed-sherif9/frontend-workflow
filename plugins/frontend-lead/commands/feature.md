---
description: Run the full lead pipeline for a feature - plan, approve, build, test, verify, review, fix, report
argument-hint: <feature description>
---

Run the full lead workflow for this request:

$ARGUMENTS

Load the `frontend-lead:feature-workflow` and `frontend-lead:engineering-standards` skills, then follow the workflow exactly:

1. Restate the goal and acceptance criteria.
2. Delegate planning to `frontend-architect`. Present the plan and **stop for my approval** before any code is written.
3. After approval, delegate each task to its owner role using the brief template, in dependency order.
4. Delegate tests to `test-automator`.
5. Make sure lint, typecheck and tests pass.
6. Run the review step (see `/frontend-lead:review`) and fix every BLOCKER and MAJOR finding through the owning role.
7. Finish with the report template. Do not commit.
