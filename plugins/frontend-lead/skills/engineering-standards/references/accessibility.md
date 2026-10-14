# Accessibility (WCAG 2.2 AA)

## Structure
- One `<h1>` per page; headings in order without skipping levels.
- Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`; a "skip to content" link.
- `lang` on `<html>` and `dir="rtl"` for RTL locales.
- Use the right element: `<button>` for actions, `<a href>` for navigation. Never a clickable `<div>`.

## Keyboard and focus
- Everything interactive is reachable and usable with the keyboard, in a logical order.
- Visible focus indicator (never `outline: none` without a replacement).
- Dialogs trap focus, close on Escape, and return focus to the trigger. Use an accessible primitive library (Radix, React Aria, Headless UI) instead of hand-rolling.
- Target size at least 24×24 CSS px.

## Forms
- Every input has a visible `<label>` (placeholder is not a label).
- Errors are announced (`aria-describedby`, `aria-invalid`, live region) and described in text, not only with color.
- Group related controls with `<fieldset>`/`<legend>` (e.g. pickup/return date).
- Correct `type`, `inputMode` and `autocomplete` attributes.

## Content
- Text contrast ≥ 4.5:1 (3:1 for large text and UI components).
- Meaningful `alt` text for informative images; `alt=""` for decorative ones.
- Do not convey information by color alone.
- Respect `prefers-reduced-motion` for animations.
- Content works at 200% zoom and 320 px width without horizontal scrolling.

## ARIA
Native HTML first. Use ARIA only to fill gaps, and never put a role on an element that contradicts its native semantics. A wrong ARIA attribute is worse than none.

## Testing
- Automated: eslint-plugin-jsx-a11y in lint, axe in component/e2e tests, Lighthouse accessibility ≥ 95.
- Manual for UI changes: keyboard-only pass and a quick screen-reader check of the changed flow.
