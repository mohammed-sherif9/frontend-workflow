---
name: bootstrap-project
description: Set up a Next.js/React/TypeScript project for the frontend-lead workflow - project CLAUDE.md, strict TypeScript, ESLint, Prettier, dependency-cruiser architecture rules, Vitest, Playwright, Lighthouse CI, Husky/lint-staged and a CI pipeline - from the plugin's templates. Use when the user asks to bootstrap, set up or standardize a project's tooling.
---

# Bootstrap a project

Templates live in `${CLAUDE_PLUGIN_ROOT}/templates/`. Read each one before using it.

Most target files are protected config files, so each write will ask the user for approval. That is expected: tell the user up front that they will see approval prompts and why.

## Steps

1. **Inspect first.** Read `package.json`, the lockfile type (npm/pnpm/yarn/bun), Next.js version, existing configs (eslint, tsconfig, prettier, vitest/jest, playwright, husky, CI) and the folder structure. Never overwrite an existing config blindly: merge, and show the user a summary of what will change.
2. **Agree the plan with the user.** List which pieces you will add or change and which dev dependencies will be installed. Wait for approval.
3. **Project rules.** Create `CLAUDE.md` from `templates/CLAUDE.md`, filling in what you learned (stack, scripts, structure, domain words). Leave clear `TODO` markers for facts only the user knows.
4. **Dependencies.** Ask the user to approve installing the dev dependencies listed in `templates/dev-dependencies.md` with the project's package manager. Install only what is missing.
5. **Configs.** Apply, adapting paths to the project:
   - `tsconfig.strict.json` → merge the stricter options into `tsconfig.json`
   - `eslint.config.mjs`
   - `prettier.config.mjs`
   - `.dependency-cruiser.cjs` (adjust `src/` paths if the project has no `src/`)
   - `vitest.config.mts` and `vitest.setup.ts`
   - `playwright.config.ts`
   - `lighthouserc.json` (set the URLs of the key routes)
   - `lint-staged.config.mjs`, and `husky/pre-commit` + `husky/pre-push` → `.husky/`
   - `github-ci.yml` → `.github/workflows/ci.yml` (match the package manager and Node version)
   - `security-headers.ts` → wire into `next.config` `headers()` and tighten the CSP for the domains the site really uses
6. **Scripts.** Merge the scripts from `templates/package-scripts.json` into `package.json`.
7. **Project settings.** Create `.claude/settings.json` from `templates/claude-settings.json` so teammates get the plugin automatically, and `.env.example` if missing (names only, no values).
8. **Run everything once:** `typecheck`, `lint`, `test`, `depcruise`. Existing code will probably fail some new rules. Do not fix the whole codebase now: report the counts per rule to the user and propose a plan (fix now, fix gradually, or relax a specific rule with their approval).
9. **Report** what was added, what failed, and the next step.
