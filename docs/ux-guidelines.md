# UX guidelines

Rules for the site's UI, mostly from the owner's feedback while using it. Read this before
UI work. Add a rule when feedback points at a pattern, not a one-off. Keep each rule short,
with the reason.

## Tables
- **One row-separation cue: faint zebra stripes, no row borders.** Separation is drawn on
  every row all the time; stripes and borders both do that job, and using both reads as
  busy. Stripes help follow long rows of numbers, on touch screens too. Stripe data rows
  only; section header rows don't count and the stripes restart after them. A rule under the
  header row is fine: it separates names from data, not row from row.
- **One focus state, in the same neutral tint as the stripe, only stronger.** Hover shows
  which numbers belong to which card. No click-to-pin highlight: it was tried and dropped
  as clutter. Mouse only
  (`@media (hover: hover)`): on touch screens a tap highlight lags the tap and adds little,
  so phones get the stripes alone. Don't colour it with the accent: keep the accent for
  links, focus rings, and meaningful highlights. Use the shared `--row-stripe` /
  `--row-hover` tokens, derived from the theme colours so they work in dark mode. Rows set
  `--row-tint` and cells paint it.
- **Tables must be readable without hover.** Touch screens have none, so never put
  information only in a hover state.
- **Label column sticks when a table scrolls sideways** (`.sticky-col`, opaque, layering the
  row tint over the page background), so the card name stays in view on a phone.
- **Header row sticks to the top of the window while the table is in view**
  (`.table-scroll.sticky-head` + `useStickyHead`). Use native `position: sticky`, never a
  script that moves the header on scroll: that lags a frame behind, so rows flash over it and
  it sits low on phones. Sticky only works if the wrapper doesn't scroll sideways, so the
  hook turns sideways scrolling on only when the table doesn't fit. Keep tables narrow
  enough to fit a 360px phone (smaller text, two-line column names) so the header sticks there.
- Numbers right-aligned with `tabular-nums` so digits line up; the label column is left-aligned.
- Wide tables scroll inside `.table-scroll` instead of widening the page on mobile.

- **Column explanations go in header tooltips** (`HelpHeader`), not in a paragraph above
  the table. Each one opens on hover, keyboard focus, or tap, closes on Escape, and is read
  by screen readers. Dotted underline marks headers that have one. Never use only the native
  `title` attribute: it doesn't work on touch or keyboard. Keep must-read information
  visible, not in a tooltip.

## Card lists
- **One card order everywhere** (`sortEntries` in `web/src/deck/order.ts`, applied in
  `useDeckText`): tables, dropdowns, group checkboxes and the deck view all list cards the
  same way, so a card is always where you expect it. Pokémon, then Trainers, then Energy.
  Trainers and Energy go by count, then name. Pokémon keep each evolution line together,
  most basic stage first, and lines go by their total copies. Exported decklists and share
  links keep the user's own order.
- **Every card picker is a `CardSelect`** (`web/src/components/CardSelect.tsx`): any
  dropdown that picks one of a deck's cards or groups (a "card identifier"). It lists them
  under Pokémon / Trainer / Energy / Groups separators (native `optgroup`, empty sections
  left out) and labels same-name cards with their print. Never hand-roll a `<select>` of
  cards; extend `CardSelect` instead, so all pickers keep the same behaviour and look.

- **Card names show the card's image** (`CardName` in `web/src/components/CardName.tsx`):
  wrap every card name in a table or list with it, so look-alike cards (several Applin) can
  be told apart. It opens on mouse hover after a short delay (instant while moving between
  names), on keyboard focus, or on tap; Escape, a tap elsewhere, or scrolling closes it. The
  preview never catches the pointer, so it doesn't block the names under it. The image is
  the card's display print (the same print everywhere). Same-name cards also get their print
  in the label (`cardLabeler`), because tables must be readable without hover.
- **Anything that opens on hover gets the dotted underline** (help headers, card names), so
  the one cue means "more here" everywhere. Where it repeats down a whole column (card
  names), draw it fainter and go full strength on the one being pointed at, so lists don't
  look busy.

## General
- Every new colour must work in both light and dark mode: use or derive from the `:root`
  tokens, never hardcode a one-theme colour.
- Accessibility basics are enforced by the `jsx-a11y` lint rules (labels, alt text,
  keyboard access). Fix them; don't disable them.
