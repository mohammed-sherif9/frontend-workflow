# frontend-workflow guide

How the workflow works, how to use it day to day, and how it helps. For the full reference (roles, hook rules, settings, overrides), see the [README](../README.md).

---

## What it is

A Claude Code plugin that makes Claude work like a **lead frontend engineer** on Next.js / React / TypeScript projects. You ask for something in plain language. Claude plans it, gets your approval, hands each part to a specialist subagent, has the result tested and reviewed, and only then reports back.

The rules are enforced by hooks, not just written in a prompt. Claude can't skip a step, and a subagent can't step outside its role.

## How it helps

| Without the workflow | With the workflow |
|---|---|
| Claude starts coding straight away, sometimes in the wrong direction | You see and approve a plan (files, contracts, tasks, reviewers) before any code is written |
| One agent writes code, tests and reviews its own work | Builders, the tester and reviewers are separate roles; reviewers can't edit, builders can't touch tests or configs |
| "Done" can mean "it compiles" | Done means lint, typecheck and tests pass, the right reviewers ran, and `surgeon-reviewer` said SHIP |
| Reviews depend on remembering to ask | Specialist reviewers are added automatically from the files that changed (accessibility, performance, SEO, security, architecture, dependencies) |
| Acceptance criteria get lost between plan and code | With a spec file, every criterion maps to the plan and has a test, and `qa-expert` checks each one |
| Secrets, lockfiles and configs can be edited by accident | `.env` can't be read; lockfiles, build output and configs are blocked or need your approval |
| Hand-written code skips review | The same gate runs on `git push` and on every pull request |

## How it works

```
 you type a request
        │
        ▼
 ┌──────────────┐   classifies it: feature · refactor · fix · change · quick · question
 │   router     │   injects the matching pipeline (and the spec file, if you named one)
 └──────┬───────┘
        ▼
 ┌──────────────┐   frontend-architect writes the plan
 │    plan      │   Claude shows it and STOPS: "Reply approve…"
 └──────┬───────┘   (builders are blocked until you approve)
        ▼
 ┌──────────────┐   typescript-pro → nextjs-developer → react-specialist
 │    build     │   each with a strict brief: exact files, contract, criteria
 └──────┬───────┘
        ▼
 ┌──────────────┐   test-automator: tests for the new behaviour
 │    test      │   (one per acceptance criterion when there is a spec)
 └──────┬───────┘
        ▼
 ┌──────────────┐   lint · typecheck · related tests, run automatically
 │   verify     │   failures go back to the role that owns the file
 └──────┬───────┘
        ▼
 ┌──────────────┐   code-reviewer + routed specialists, in parallel
 │   review     │   BLOCKER/MAJOR findings go back to the owner, then re-review
 └──────┬───────┘
        ▼
 ┌──────────────┐   surgeon-reviewer: SHIP / NO SHIP
 │  final gate  │
 └──────┬───────┘
        ▼
     report
```

Four kinds of hooks keep this in order:

- **SessionStart** puts the roles and rules into context at the start of every session (and after a context compaction).
- **UserPromptSubmit (router)** classifies each message and adds the pipeline for it. The full pipeline and spec are sent once per task; follow-ups get a one-line reminder, to save tokens.
- **PreToolUse guards** check every file read, file write, shell command and subagent call against the caller's role. A blocked call means "you are outside your role".
- **SubagentStop / Stop gates** run the checks when a subagent or Claude finishes, and send Claude back with the exact missing steps if something was skipped.

## Using it day to day

You don't need commands. Write the request the way you'd say it to a teammate.

| You write | Detected as | What runs |
|---|---|---|
| "Add a booking summary section to the car page" | feature | plan → **you approve** → build → tests → verify → reviews → final gate → report |
| "Refactor the fleet filters into one hook" | refactor | plan → **you approve** → refactoring-specialist → verify (existing tests unchanged) → reviews → final gate |
| "The checkout button is broken on mobile" | fix | debugger if unclear → regression test → minimal fix → verify → code-reviewer → final gate |
| "Change the hero title color to the brand blue" | change | builder → tests if new files → verify → code-reviewer + routed specialists |
| "quick: fix the typo in the footer" | quick | Claude edits directly → verify → code-reviewer |
| "How does the pricing hook work?" | question | a normal answer |
| "… #no-workflow" | off | no pipeline for this message (role guards still apply) |

Detection uses trigger words. "Add a … page/form/section", "implement the …", "build a …" count as features; "fix", "bug", "broken", "error" count as fixes. Arabic works too ("ضيف صفحة", "صلح", "غير"). If a request isn't picked up the way you meant, start it with the slash command (`/frontend-workflow:feature …`) or rephrase.

### Approving the plan

Claude ends the plan with **Reply "approve" to start building, or tell me what to change.**

| You reply | What happens |
|---|---|
| `approve`, `go ahead`, `lgtm`, `موافق`, `تمام`, `يلا` | building starts and runs to the end without stopping |
| `approve, but name the route /deals` | approved, with that instruction applied |
| anything else | treated as feedback: the plan is revised and shown again |
| `cancel`, `no`, `الغي` | the task is dropped |

After approval, Claude stays inside the plan. If it needs a different approach, a new dependency, or files outside the plan, it asks you again.

## Working from a spec

For anything bigger than a small change, write the requirements in a spec file and name it in your request. The router reads the file and gives it to the planner, the tester and `qa-expert`.

`specs/airport-transfer/spec.md`:

```markdown
# Airport transfer booking

## Goal
Customers book a car from Cairo Airport (CAI) to an address and see the price before confirming.

## Acceptance criteria
- AC1: The user picks terminal, flight number, date/time and destination address.
- AC2: Flight number is validated (e.g. MS985); invalid input shows an inline error.
- AC3: Price is shown before confirm, based on car class.
- AC4: Confirm creates the booking and shows a confirmation page with a reference.
- AC5: The form works in Arabic (RTL) and English.
- AC6: The page has its own title and description.
```

Then:

> Implement the airport transfer booking from specs/airport-transfer/spec.md

What the spec adds:

- every acceptance criterion maps to a file, contract or task in the plan;
- every criterion gets at least one test, named after it (e.g. `AC2: rejects invalid flight number`);
- `qa-expert` reports any criterion without a test or implementation as a BLOCKER;
- if the spec and the code disagree, Claude stops and asks you instead of changing the spec.

Tips: number the criteria (AC1, AC2…), keep each one testable, and write "out of scope" items down too. Specs over 30,000 characters are truncated, and Claude is told to read the rest.

## A full example

1. **You:** "Implement the airport transfer booking from specs/airport-transfer/spec.md"
2. **Plan:** `frontend-architect` proposes the files (`features/airport-transfer/types.ts`, `schema.ts`, `pricing.ts`, `actions.ts`, `TransferForm.tsx`, the page and the confirmation page), maps AC1–AC6 to them, lists the reviewers, and asks one open question: fixed prices or the pricing API?
3. **You:** "Pricing comes from /api/pricing" → the plan is revised. **You:** "approve".
4. **Build:** `typescript-pro` writes the types and schema, `nextjs-developer` the server action and pages, `react-specialist` the form and price summary. Each can only write the files in its brief.
5. **Tests:** `test-automator` writes one or more tests per criterion.
6. **Verify:** lint, typecheck and tests run; a failure goes back to the builder who owns the file.
7. **Reviews:** `code-reviewer`, `architect-reviewer`, `qa-expert`, plus `security-auditor` (server action, form input), `accessibility-tester`, `performance-engineer` and `seo-specialist` (public page). Say qa-expert finds "AC5 has no RTL test": it goes back to `test-automator`, then qa-expert runs again.
8. **Final gate:** `surgeon-reviewer` says SHIP.
9. **Report:** what changed, files, checks, reviews, decisions, follow-ups. Nothing is committed until you ask.

## Writing documentation

Docs requests run without the pipeline: `.md`, `.mdx` and anything in `docs/` are not code, so no plan, tests or reviews are required.

> Write documentation for the airport transfer feature in docs/airport-transfer.md: how booking works, the server action, pricing and how to run the tests. Use documentation-engineer.

`documentation-engineer` can write only docs and can't touch code, so it's a safe choice for larger docs. Inside a feature, the pipeline adds a docs step when setup, public APIs or behaviour others rely on changed.

## Code you write yourself

The autopilot covers what Claude does. For your own code, `/frontend-workflow:bootstrap` sets up the same review in two places:

- **On `git push`:** a pre-push hook runs the gate on the commits being pushed and blocks the push on NO SHIP. `CLAUDE_GATE_MODE=warn` reports without blocking; `SKIP_CLAUDE_GATE=1 git push` skips once.
- **On pull requests:** a GitHub Actions workflow runs the gate and posts the report as a comment.

## Keeping it fast and cheap

The workflow does more work per task than plain prompting, by design. To keep the cost where it pays off:

- **Size the request.** Use `quick:` for one-line edits, and phrase small edits as changes ("change…", "update…") so they skip the planner and the full review set.
- **Use a spec for features.** A clear spec means fewer plan revisions and fewer review round-trips.
- **Approve with notes** ("approve, but …") instead of another round of feedback when the change is small.
- **Use a strong model for the session** (it plans and orchestrates); the subagents do the narrow work.
- **Stay in one task.** Follow-ups in the same task only get a short reminder, not the whole pipeline again.

## Troubleshooting

| Problem | What to check |
|---|---|
| Nothing happens, Claude just answers | Is the plugin installed and enabled (`/plugin`)? Is `autopilot` on? Did the request contain a trigger word? Try `/frontend-workflow:feature …` |
| "Blocked" message from a hook | The caller is outside its role (e.g. the lead writing code during a feature, a reviewer editing). Delegate to the owning role instead of working around it |
| Claude keeps getting sent back before finishing | A required step is missing (tests, a reviewer, the final gate). It is told exactly which; after `max_gate_rounds` the open steps are reported to you |
| Updated the plugin but nothing changed | Bump `version` in `plugins/frontend-workflow/.claude-plugin/plugin.json`, push, update the plugin from `/plugin`, and restart Claude Code |
| Can't find `plugin.json` | It's in the hidden `.claude-plugin/` folder (`ls -a`, or show hidden files in your file manager) |
| A project needs different rules | Add `.claude/frontend-workflow.roles.json` in that project (see the README's per-project overrides) |
