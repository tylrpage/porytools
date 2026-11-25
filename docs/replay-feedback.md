# Replay viewer feedback (intake)

Rough intake for the owner's review of the visual replay viewer (`/replay`). One line of
feedback per item, the cause found, and status. Patterns go into `docs/ux-guidelines.md`
when fixed. Delete items once done and the owner has checked them; delete the file when empty.

## Round 1 (2026-11-24)

1. ☑ **Horizontal view in a half-screen window.** A half-screen window (about 1092×1114 CSS
   px, a touch taller than wide) gets the vertical view; widening it slightly gives the
   horizontal one. Cause: `WIDE` in `replay/hooks.ts` needs aspect ≥ 1/1. Relax to ~4/5,
   keep `min-width: 60rem`; update `docs/replay-viewer.md`.
2. ☐ **Centre text in empty slots** ("No Stadium" and similar zone labels). Cause: `.slot`
   sets `display: block`, overriding `.stadium-empty`'s flex centring. Pattern → guideline.
3. ☐ **Both Active Spots line up horizontally.** Cause: the mirrored grids have different
   column widths (prizes fixed, deck/discard `auto`), ~25px apart. Same column widths on
   both sides.
4. ☐ **Both players' prizes on the left.** The top side stays mirrored otherwise (Active
   nearest the middle line).
5. ☐ **Prize stack straight down**, no sideways offset (`.fan-card` left offset).
6. ☐ **Stray lighter blocks on the bottom (blue) side in actions 0–3**, gone at action 4.
   Seen in the vertical view either side of the Active slot. Not yet reproduced.
7. ☑ **Turn buttons take the ⏮/⏭ icons; drop the first/last-action buttons.** Leaves
   previous turn, previous action, next action, next turn. Home/End keys stay.
8. ☐ **Centre the hands horizontally** (bottom hand and top hand strip).
9. ☐ **Player areas keep one size all game, with even padding.** Areas size to content and
   the board centres them, so the bottom area grows from 347 to 472px when the hand arrives
   and highlight outlines nudge sizes. Areas fill the board with fixed room for hands and
   outlines; grey gap the same on all four sides. Pattern → guideline.
