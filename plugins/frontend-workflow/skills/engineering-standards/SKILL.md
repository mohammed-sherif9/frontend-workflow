---
name: engineering-standards
description: The lead frontend engineer's standards for Next.js/React/TypeScript work - architecture and folder structure, clean code and SOLID, TypeScript/React/Next rules, testing, security, performance, accessibility and SEO, plus the definition of done. Use before planning, implementing or reviewing any frontend change.
---

# Frontend engineering standards

These are the default standards. The project's `CLAUDE.md` overrides them where it says something different.

Read the reference file for the area you are working on. Do not load all of them by default.

| Area | Reference | Read when |
|---|---|---|
| Architecture & structure | `references/architecture.md` | adding files/folders, features, cross-feature imports, planning |
| Clean code & SOLID | `references/clean-code-solid.md` | writing or reviewing any code |
| TypeScript, React, Next.js | `references/typescript-react-next.md` | writing or reviewing components, hooks, routes, types |
| Testing | `references/testing.md` | writing or reviewing tests, planning a test strategy |
| Security | `references/security.md` | forms, auth, user input, env vars, headers, dependencies, server actions |
| Performance | `references/performance.md` | UI, data fetching, images, fonts, bundles, caching |
| Accessibility | `references/accessibility.md` | any UI change |
| SEO | `references/seo.md` | public pages, routing, metadata, content |

## The ten rules that apply everywhere

1. **Feature-based structure.** Code lives in the feature it belongs to. Features talk to each other only through their public `index.ts`.
2. **Dependencies point inward.** `app/` → `features/` → `shared/`. Never the other way. No cycles.
3. **Strict TypeScript.** No `any`, no `@ts-ignore`, no non-null `!` without a proven reason. Validate external data at the boundary (zod or similar) and trust types inside.
4. **Server first.** Server Components by default; `"use client"` only for interactivity, and as low in the tree as possible.
5. **Small units, one job each.** A component, hook or function has one reason to change. Extract when it grows past roughly 150 lines or mixes data, logic and layout.
6. **Every state is designed.** Loading, empty, error and success states exist for every async UI.
7. **Accessible by default.** Semantic HTML first, ARIA second, keyboard always.
8. **Measured performance.** Respect the budgets in `references/performance.md`; no new heavy dependency without dependency-manager review.
9. **Secure by default.** Never trust input, never expose secrets to the client, never render unsanitized HTML.
10. **Tested behavior.** New behavior ships with tests at the right level; bugs ship with a regression test.

## Definition of done

A change is done only when all of these are true:

- [ ] Acceptance criteria met and demonstrated (test or explained manual check)
- [ ] Lint, typecheck and tests pass; no new warnings
- [ ] No banned patterns (`any`, `@ts-ignore`, `eslint-disable`, `console.log`, `.only`, unsanitized HTML)
- [ ] Loading, empty and error states handled
- [ ] Keyboard and screen-reader basics checked for UI changes
- [ ] Public pages have correct metadata, canonical URL and structured data where relevant
- [ ] No new dependency without review; bundle impact checked for client code
- [ ] Reviews run (code-reviewer and architect-reviewer at minimum) and all BLOCKER/MAJOR findings fixed
- [ ] Docs updated when behavior, setup or public APIs changed
