# UX guidelines

Rules for the site's UI, mostly from the owner's feedback while using it. Read this before
UI work. Add a rule when feedback points at a pattern, not a one-off. Keep each rule short,
with the reason.

## Tables
- **Zebra stripes on data rows.** Long rows of numbers are hard to follow across the line.
  Stripe data rows only; section header rows don't count and the stripes restart after them.
- **Hover highlights the whole row.** It shows which numbers belong to which card. Use the
  shared `--row-stripe` / `--row-hover` tokens. They're derived from the theme colours, so they
  work in dark mode too. Apply hover to the cells (`tr:hover > *`), not the `tr`, or the
  higher-specificity stripe rule hides it on striped rows.
- Numbers right-aligned with `tabular-nums` so digits line up; the label column is left-aligned.
- Wide tables scroll inside `.table-scroll` instead of widening the page on mobile.

- **Column explanations go in header tooltips** (`HelpHeader`), not in a paragraph above
  the table. Each one opens on hover, keyboard focus, or tap, closes on Escape, and is read
  by screen readers. Dotted underline marks headers that have one. Never use only the native
  `title` attribute: it doesn't work on touch or keyboard. Keep must-read information
  visible, not in a tooltip.

## General
- Every new colour must work in both light and dark mode: use or derive from the `:root`
  tokens, never hardcode a one-theme colour.
- Accessibility basics are enforced by the `jsx-a11y` lint rules (labels, alt text,
  keyboard access). Fix them; don't disable them.
