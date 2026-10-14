# Technical SEO for Next.js

## Every public page
- Unique `title` (≈50–60 chars) and `description` (≈140–160 chars) via `generateMetadata`, built from a shared helper so the pattern is consistent.
- Absolute canonical URL (`alternates.canonical`), using `metadataBase` in the root layout.
- Open Graph and Twitter metadata with a 1200×630 image (`opengraph-image.tsx` or a static file).
- Exactly one `<h1>` that matches the page intent; logical heading hierarchy.
- Server-rendered main content (no content that only appears after client JS).
- Descriptive internal links with real anchor text; no orphan pages.

## Multilingual sites
- `alternates.languages` (hreflang) for every locale plus `x-default`.
- Locale in the URL (`/ar/...`, `/en/...`), not only in cookies.
- Translated slugs and metadata, `lang` and `dir` on `<html>`.

## Structured data (JSON-LD)
- Add with a `<script type="application/ld+json">` rendered on the server, built from typed helpers.
- Use the type that matches the page: `Organization`/`LocalBusiness` (site-wide), `Product`/`Offer` for rentable items, `BreadcrumbList`, `FAQPage` only for visible FAQs, `Article` for blog posts.
- Data in JSON-LD must match what is visible on the page.
- Validate with Google's Rich Results Test before release.

## Crawling and indexing
- `app/sitemap.ts` generated from real routes/data, split if large, with `lastModified`.
- `app/robots.ts` allowing public pages, disallowing private/admin/search-result pages, and linking the sitemap.
- `noindex` for thin, duplicate, filtered or internal pages (`robots: { index: false }`).
- Correct status codes: real 404 via `notFound()`, 301 via `permanentRedirect` for moved pages. No soft 404s.
- Clean, lowercase, hyphenated URLs; one URL per piece of content (handle trailing slashes and query params consistently).

## Performance is SEO
Core Web Vitals budgets in `performance.md` apply. Lighthouse SEO score ≥ 95 on key routes.

## Review checklist (seo-specialist)
title/description unique and sized · canonical correct · hreflang complete · one h1 · JSON-LD valid and matches page · in sitemap · robots correct · indexable status intended · internal links · images have alt · CWV within budget
