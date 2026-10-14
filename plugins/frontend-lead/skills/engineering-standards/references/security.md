# Frontend security

## Input and output
- Validate all external input with a schema on the server (server actions, route handlers), even if the client validated it too.
- React escapes text by default. Never use `dangerouslySetInnerHTML` unless the HTML is sanitized (DOMPurify / isomorphic-dompurify) and the reason is documented.
- Never build URLs, `href`s or redirects from user input without validating the scheme and host (block `javascript:` and open redirects).
- No `eval`, `new Function`, or string-based `setTimeout`.

## Secrets and env
- Only variables prefixed `NEXT_PUBLIC_` reach the browser. Never put tokens, keys or passwords there.
- Server-only modules import `"server-only"`.
- `.env*` files are never committed (except `.env.example` with names only) and never read into AI context.
- Validate env at startup in one typed module.

## Auth and data access
- Check authentication **and** authorization inside every server action and route handler. Hiding a button is not authorization.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`).
- Never return more data than the UI needs (no full user objects with internal fields).
- Rate-limit public mutations (contact forms, bookings, login) and protect them against bots (captcha/turnstile where abuse is likely).

## HTTP headers (set in `next.config` headers or middleware)
- `Content-Security-Policy` (start strict; use nonces for inline scripts if needed)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` limiting camera, microphone, geolocation to what is used
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`)
A ready-made version is in `${CLAUDE_PLUGIN_ROOT}/templates/security-headers.ts`.

## Dependencies
- No new dependency without dependency-manager review (need, size, maintenance, license, known CVEs).
- `npm audit --omit=dev` (or pnpm equivalent) in CI; high/critical findings block the merge.
- Lockfile committed; installs in CI use the frozen lockfile.

## Third-party scripts
Load analytics and widgets with `next/script` and an explicit strategy, list their domains in the CSP, and avoid giving them access to sensitive pages (checkout, account).
