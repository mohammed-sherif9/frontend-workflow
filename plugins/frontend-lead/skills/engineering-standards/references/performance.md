# Performance

## Budgets (mobile, p75, measured with Lighthouse CI and field data)
| Metric | Budget |
|---|---|
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| TBT (lab) | ≤ 200 ms |
| First-load JS per route | ≤ 170 KB gzipped (set per project) |
| Lighthouse Performance score | ≥ 90 |

## Rendering
- Server Components by default; keep client components small and at the leaves.
- Static or ISR for marketing and listing pages; dynamic only where data must be per-request.
- Stream slow parts with Suspense instead of blocking the whole page.
- Avoid request waterfalls: start independent fetches in parallel (`Promise.all`), preload where useful.

## JavaScript
- Check bundle impact of new client code (`@next/bundle-analyzer`). Any client dependency over ~20 KB gzipped needs a reason.
- Import only what you use (`import { format } from 'date-fns'`, not whole libraries). Prefer native APIs (`Intl`) over formatting libraries.
- Lazy-load heavy, below-the-fold or interaction-only widgets with `next/dynamic`.
- Avoid unnecessary re-renders: stable keys, state as low as possible, split contexts. Memoize only with a reason.

## Images and media
- `next/image` always, with `sizes` for responsive images and `priority` only for the LCP image.
- Modern formats (AVIF/WebP) via Next image optimization. Explicit dimensions to prevent layout shift.
- Video: no autoplaying heavy hero videos on mobile; use a poster image.

## Fonts
- `next/font` with `display: swap`, subset to the needed scripts (e.g. latin + arabic), at most 2 families and the weights actually used.

## Caching
- Choose a caching strategy per fetch on purpose (`revalidate`, tags) and write it in the plan.
- Static assets are immutable and long-cached (Next does this by default for hashed files).

## Measuring
- Lighthouse CI on key routes in CI with the budgets above.
- Field data (Vercel Analytics / web-vitals reporting) is the source of truth; lab data catches regressions early.
