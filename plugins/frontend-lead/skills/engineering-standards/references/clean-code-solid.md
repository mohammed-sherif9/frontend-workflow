# Clean code and SOLID in a React codebase

## Naming
- Components: `PascalCase` nouns (`BookingSummary`). Hooks: `useX` describing what they give (`useAvailableCars`).
- Functions: verbs (`calculateTotal`, `formatPrice`). Booleans: `is/has/can/should` (`isOpen`).
- Files: match the main export. One component per file (small private helpers are fine).
- No abbreviations a new teammate would not know. No `data`, `info`, `item`, `handleStuff` when a precise name exists.

## Functions and components
- One level of abstraction per function. Extract when you need a comment to explain a block.
- Early returns over nested conditionals. Max nesting depth: 3.
- Max ~4 parameters; use an options object beyond that.
- No magic numbers or strings; use named constants or config.
- Pure where possible: the same input gives the same output, no hidden side effects.
- No dead code, commented-out code or speculative abstractions ("we might need it").

## SOLID, applied to frontend

**S - Single responsibility.** A component either fetches/orchestrates (container) or renders (presentational), not both when it grows. A hook manages one concern. Business rules live in `services/`, not in JSX.

**O - Open/closed.** Extend through props, composition (`children`, slots, render props) and variant maps instead of editing a growing chain of `if (type === ...)`. A new variant should be a new entry, not a new branch.

**L - Liskov substitution.** A wrapper of a native element accepts and forwards that element's props (`ComponentProps<'button'>`) and behaves like it: same events, refs, accessibility. A specialized component must work wherever the base one works.

**I - Interface segregation.** Props describe what the component needs, not the whole domain object. Pass `price` and `currency`, not the entire `Car` when only two fields are used. Split "god props" into smaller components.

**D - Dependency inversion.** Components depend on abstractions: hooks or injected functions (`onSubmit`, `fetcher`), not on concrete API clients or `fetch` calls in the component body. This makes them testable and reusable.

## DRY, but not too early
Duplicate twice, abstract on the third time, and only when the copies change for the same reason. The wrong abstraction is worse than duplication.

## Errors
- Never swallow errors (`catch {}`). Handle, rethrow with context, or report.
- Use error boundaries (`error.tsx`) per route segment.
- User-facing messages are human and actionable; technical detail goes to the logger.

## Comments
Explain *why*, not *what*. Public functions in `shared/` get a one-line TSDoc. TODOs reference a ticket.
