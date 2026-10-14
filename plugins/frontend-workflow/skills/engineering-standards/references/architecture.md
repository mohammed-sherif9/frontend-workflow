# Architecture and structure

## Folder layout (Next.js App Router, feature-based)

```
src/
├── app/                      # Routing only: pages, layouts, route handlers, metadata
│   ├── (marketing)/          # Route groups by area
│   ├── [locale]/             # i18n segment if the site is multilingual
│   ├── api/                  # Route handlers (thin: validate → call feature service → respond)
│   ├── layout.tsx
│   ├── sitemap.ts
│   └── robots.ts
├── features/                 # Business features: the core of the app
│   └── booking/
│       ├── components/       # UI used by this feature
│       ├── hooks/            # Client hooks for this feature
│       ├── server/           # Server-only code: queries, server actions ("server-only")
│       ├── services/         # Pure business logic, no React
│       ├── schemas/          # zod schemas = runtime validation + inferred types
│       ├── types/            # Types not derived from schemas
│       ├── utils/            # Feature-specific helpers
│       ├── constants.ts
│       └── index.ts          # PUBLIC API: the only file other features may import
├── shared/                   # Reusable, feature-agnostic code
│   ├── ui/                   # Design-system primitives (Button, Dialog, Input)
│   ├── lib/                  # Framework-agnostic helpers (formatting, fetch client)
│   ├── hooks/                # Generic hooks (useMediaQuery, useDebounce)
│   ├── config/               # Typed env access, site config
│   └── types/
└── styles/
```

If the project already has a different but consistent structure, follow the project. Do not restructure as a side effect of another task.

## Dependency rules

| From \ To | app | features/* (public index) | features/* (internals) | shared |
|---|---|---|---|---|
| app | ✓ | ✓ | ✗ | ✓ |
| feature A | ✗ | ✓ (other features, sparingly) | own internals only | ✓ |
| shared | ✗ | ✗ | ✗ | ✓ |

- No circular imports, including through barrels.
- A feature never imports another feature's internals (`features/x/components/...`). Use `features/x` (its `index.ts`).
- If two features need the same thing, move it to `shared/` or create a new feature that both depend on.
- Server-only modules import `"server-only"` so they cannot leak into client bundles.
- Barrels: one `index.ts` per feature as its public API. Do not create barrels inside every subfolder; they slow builds and hide cycles.

These rules are enforced by `dependency-cruiser` (see the bootstrap templates) and checked by architect-reviewer.

## Layers inside a feature

1. **schemas / types**: data contracts. Nothing depends on React.
2. **services**: pure functions with the business rules. Easy to unit-test.
3. **server**: data access and server actions. Validate input with the schema, check auth, call services.
4. **hooks**: client state and side effects. No business rules that belong in services.
5. **components**: presentation and composition. Container components wire hooks to presentational components.

## Decisions worth writing down

Write a short ADR in `docs/adr/` (via documentation-engineer) when you choose a state library, a data-fetching strategy, an auth approach, a rendering strategy for a major route, or break a rule above on purpose.
