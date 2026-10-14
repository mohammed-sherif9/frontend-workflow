# Dev dependencies for the frontend-lead tooling

Install with the project's package manager (example for npm; use `pnpm add -D`, `yarn add -D` or `bun add -d` otherwise). Skip anything already installed.

```bash
# Lint and format
npm i -D eslint eslint-config-next typescript-eslint eslint-plugin-jsx-a11y eslint-plugin-security eslint-config-prettier prettier prettier-plugin-tailwindcss

# Architecture rules
npm i -D dependency-cruiser

# Unit / component tests
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom @vitest/coverage-v8 msw

# End-to-end + accessibility
npm i -D @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium

# Performance budgets
npm i -D @lhci/cli @next/bundle-analyzer

# Git hooks
npm i -D husky lint-staged
npx husky init

# Runtime (only if missing; these are regular dependencies)
npm i zod server-only
```

Optional: `isomorphic-dompurify` only if the project must render user HTML.
