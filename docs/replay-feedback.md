# Replay viewer feedback (intake)

Rough intake for the owner's review of the visual replay viewer (`/replay`). One line of
feedback per item, the cause found, and status. Patterns go into `docs/ux-guidelines.md`
when fixed. Delete items once done and the owner has checked them; delete the file when empty.

## Round 1 (2026-11-24)

1. ☑ **Horizontal view in a half-screen window.** A half-screen window (about 1092×1114 CSS
   px, a touch taller than wide) gets the vertical view; widening it slightly gives the
   horizontal one. Cause: `WIDE` in `replay/hooks.ts` needs aspect ≥ 1/1. Relax to ~4/5,
   keep `min-width: 60rem`; update `docs/replay-viewer.md`.
2. ☑ **Centre text in empty slots** ("No Stadium" and similar zone labels). Cause: `.slot`
   sets `display: block`, overriding `.stadium-empty`'s flex centring. Fixed on `.slot`
   itself, so every slot label is centred. Guideline added.
3. ☑ **Both Active Spots line up horizontally.** Cause: the mirrored grids have different
   column widths (prizes fixed, deck/discard `auto`), ~25px apart. Both mats now use the
   same fixed columns (prizes 1.25 cards, piles 1.25 cards, or 2.25 on both sides when
   either player has a Lost Zone). Measured: Active centres 421.1 / 445.9 → 357.8 / 357.8.
4. ☑ **Both players' prizes on the left.** The top side stays mirrored otherwise (Active
   nearest the middle line).
5. ☑ **Prize stack straight down**, no sideways offset (`.fan-card` left offset).
6. ☐ **Stray lighter blocks on the bottom (blue) side in actions 0–3**, gone at action 4.
   Seen in the vertical view either side of the Active slot. Still not reproduced in Chrome
   (vertical view at 390 and 480px wide, light and dark mode): no element in the bottom area
   has a background or outline in actions 0–3. The only thing that changed at action 4 was
   the bottom area growing for the hand, which item 9 removed. Owner to recheck; if it's
   still there, note the browser and screen size.
7. ☑ **Turn buttons take the ⏮/⏭ icons; drop the first/last-action buttons.** Leaves
   previous turn, previous action, next action, next turn. Home/End keys stay.
8. ☑ **Centre the hands horizontally** (bottom hand and top hand strip). The count stays at
   the left and the cards are centred on the row; a hand too wide for that moves right to
   clear the count, then scrolls.
9. ☑ **Player areas keep one size all game, with even padding.** Areas size to content and
   the board centres them, so the bottom area grows from 347 to 472px when the hand arrives
   and highlight outlines nudge sizes. Now every row has a fixed height in card sizes (hand
   row with room for outlines and a scroll bar, hand strip, mat rows, middle line), the
   areas share the leftover height, and Special Conditions sit over the card instead of
   under it. Measured (1092×1000 horizontal; 390×844 vertical): area heights identical at
   actions 0, 3, 4, 20, 30, 45 and in the solver sample; grey gap equal on all four sides
   (6.2px; was 134 top/bottom vs 8 sides at action 0). A caption longer than the middle line
   now spills over the areas instead of resizing them. Guideline added.
