# TypeScript, React and Next.js rules

## TypeScript
- `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- No `any`. Use `unknown` and narrow, generics, or a proper type. No `as` casts to silence errors; a cast needs a comment explaining why it is safe.
- Derive types from schemas: `type Booking = z.infer<typeof bookingSchema>`.
- Prefer union types and discriminated unions over enums and boolean flags (`status: 'idle' | 'loading' | 'error' | 'success'`).
- Exhaustive `switch` with a `never` check.
- `readonly` for data that must not change; `as const` for literal config.
- Exported functions have explicit return types.
- Typed env access through one module (`shared/config/env.ts`) validated with zod at startup. Never read `process.env` across the codebase.

## React
- Function components only. Props typed with an interface or type named `XProps`.
- Keys are stable ids, never array indexes for dynamic lists.
- Derive state instead of syncing it. If it can be calculated from props or other state, do not store it.
- `useEffect` only to sync with something outside React. Not for data transformations, not for event handling, not for data fetching in Server Component apps.
- Memoization (`useMemo`, `useCallback`, `memo`) only with a measured reason or a referential-equality need (dependency of another hook, memoized child).
- State lives as low as possible; lift only when shared. Avoid prop drilling deeper than 2 levels: use composition first, context second, a store last.
- Context: split by concern and by update frequency; memoize the value.
- Forms: controlled by a form library (e.g. react-hook-form + zod resolver) for anything non-trivial; schema shared with the server.
- Portals for overlays (modals, toasts, popovers), with focus management.

## Next.js (App Router)
- Server Components by default. Add `"use client"` only to the leaf that needs state, effects, event handlers or browser APIs.
- Never pass non-serializable props (functions, class instances) from server to client components.
- Data fetching in Server Components or route handlers, with explicit caching (`revalidate`, tags) chosen on purpose and noted in the plan.
- Server Actions: validate input with zod, check auth/authorization inside the action, return typed results, call `revalidatePath`/`revalidateTag` as needed.
- Every route segment that fetches has `loading.tsx` and `error.tsx` (or Suspense boundaries) and `not-found.tsx` where ids come from the URL.
- Metadata through `generateMetadata` / `metadata` exports, never manual `<head>` tags.
- Images through `next/image` with width/height or `fill` + `sizes`. Fonts through `next/font`.
- Links through `next/link`. External links get `rel="noopener noreferrer"` when `target="_blank"`.
- Dynamic imports (`next/dynamic`) for heavy client-only widgets (maps, editors, charts).
- `middleware.ts` stays small and fast; no heavy imports.

## Styling (Tailwind)
- Use design tokens from the Tailwind config; no arbitrary hex values or magic pixel values when a token exists.
- Merge classes with a `cn()` helper (clsx + tailwind-merge). Variants with a variant helper (e.g. cva) instead of string concatenation logic.
- Mobile-first responsive classes. Support RTL with logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) when the site has an RTL language.
