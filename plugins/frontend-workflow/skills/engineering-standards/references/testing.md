# Testing

## What to test at which level

| Level | Tool | What | Share |
|---|---|---|---|
| Unit | Vitest | services, utils, schemas, hooks with logic | most |
| Component | Vitest + React Testing Library | components' behavior through the DOM | many |
| Integration | Vitest + MSW | feature flows with mocked network | some |
| End-to-end | Playwright | critical user journeys in a real browser (search → select → book → confirm) | few |
| Accessibility | axe (jest-axe / @axe-core/playwright) | automated a11y checks on key pages and components | key pages |

## Rules
- Test behavior, not implementation. Query by role, label and text (`getByRole('button', { name: /book/i })`). `data-testid` is a last resort.
- Use `userEvent` over `fireEvent`.
- One behavior per test; the test name describes it (`shows an error when the pickup date is in the past`).
- Arrange / Act / Assert, no logic (loops, conditionals) inside tests.
- Mock at the network boundary (MSW), not internal modules. Do not mock what you own unless it is slow or non-deterministic.
- Cover: happy path, validation errors, server errors, empty state, loading state, and boundary values.
- Every bug fix ships with a regression test that fails before the fix.
- No `.only`, `.skip`, sleeps or real timers for waiting. Use `findBy*` / `waitFor` and fake timers.
- Tests are deterministic: fixed dates (`vi.setSystemTime`), seeded data, no real network.

## Coverage
- Thresholds (global): lines 80%, branches 75%, functions 80%. Services and utils aim for 90%+.
- Coverage is a signal, not the goal. A meaningful assertion beats a line hit.

## Ownership
Only `test-automator` writes tests. Builders report what needs testing; the tester decides how. If code is hard to test, that is a design smell to report to the lead, not a reason to skip tests.
