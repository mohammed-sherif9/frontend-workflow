# Project: TODO project name

> Project-specific rules. They override the generic `frontend-lead:engineering-standards`.
> Keep this file short and factual. Update it when the team decides something new.

## What this is
TODO: one paragraph — what the product does, who uses it, main user journeys.

## Stack
- Next.js TODO version (App Router), React TODO, TypeScript (strict), Tailwind CSS TODO version
- Package manager: TODO (npm / pnpm / yarn / bun) — always use it, never mix
- Data: TODO (REST API at …, CMS, database via …)
- Auth: TODO
- Hosting: TODO
- Languages / locales: TODO (e.g. ar (RTL, default) and en)

## Commands
| Task | Command |
|---|---|
| Dev server | `TODO run dev` |
| Lint | `TODO run lint` |
| Typecheck | `TODO run typecheck` |
| Unit tests | `TODO run test` |
| E2E tests | `TODO run test:e2e` |
| Architecture rules | `TODO run depcruise` |
| All gates | `TODO run verify` |

## Structure
Feature-based (`src/app`, `src/features/<name>`, `src/shared`). Features:
- `TODO-feature` — what it owns
- `TODO-feature` — what it owns

## Domain language
TODO: key terms and their meaning, so names in code match the business (e.g. "booking", "pickup", "return", "chauffeur").

## Project rules (in addition to the standards)
- TODO: e.g. all prices come from the API in minor units; format with `formatPrice()` only
- TODO: e.g. every public page must have Arabic and English metadata
- TODO: design tokens live in `tailwind.config` / `globals.css` — no raw colors

## Do not touch without asking
- TODO: e.g. `src/shared/config/payments.ts`, legacy folder `src/old/`

## Known gotchas
- TODO
