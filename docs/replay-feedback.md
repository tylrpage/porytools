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
6. ☑ **Stray lighter blocks on the bottom (blue) side in actions 0–3**, gone at action 4.
   Reproduced in Chrome (1229×1304). Cause: Chrome draws the areas' low-alpha tint
   (`color-mix(… 5%, transparent)`) unevenly across paint tiles. The tints are now opaque,
   mixed with the board colour; the blocks are gone. Guideline added.
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

## Round 2 (2026-11-25)

1. ☑ **Less empty room on the middle line.** Shorten it; the Stadium may overlap both
   player areas. Move the Stadium right so it clears the prizes (or move prizes outward,
   see 2), but leave room for the centred caption. Done: the middle line is one caption line
   (2rem; was 0.75 card + 1.5rem), the height going to bigger cards. The Stadium is centred
   on it, reaching into both areas, 0.4 card further right than before; both prize stacks
   start clear of it (~9–11px), and the caption keeps clear of it on both sides. Left as is:
   a caption with a strip of seen cards (e.g. "Reveal starting Pokémon") is taller than the
   line and, when there's no spare height, covers ~15px of each Active card for that action.
2. ☑ **Hand labels centred above each hand, from each player's view.** The opponent's
   "Opponent · Hand N" style is right; the bottom player's "You · Hand N" matches its style
   and goes at the bottom left (its own top-left, mirrored). Frees room so prizes can move
   outward from the middle and the Stadium can move a little right. Done: both labels are
   one plain line on their own row on the hand's outer side (above the top strip, below the
   bottom hand), at the left, with the cards centred under/over it. Read "centred" as the
   cards; the label stays left as asked. The bottom label still opens the hand list.
3. ☑ **Wheel over the hand scrolls the hand, not the page.** A vertical wheel over a hand
   that overflows scrolls it sideways; at either end the page scrolls as usual (so the
   footer stays reachable on a tall page). Sideways trackpad scrolling unchanged. The
   opponent's strip clips rather than scrolls, so it has nothing to scroll.
4. ☑ **Per-player mat sits lower (from that player's view)**, hand excepted: the mat is
   tight against the area's outer edge with a big gap to the hand. Margins about equal.
   Done: spare height is split evenly either side of the mat. Measured edge-to-mat /
   mat-to-hand: 22.4 / 22.4px (390×844), 56.3 / 56.3 (480×1000), 12.9 / 12.9 (1229×1304),
   10.2 / 10.2 (1092×1000 horizontal), same on both sides and at every action.
5. ☑ **New card back (still a placeholder):** stripes kept but subtler and fewer/wider; the
   centre O becomes a lowercase "p" in the header logo's font. Done: two greys 30% / 35%
   text-on-surface (was 30% / 42%), bands 8% of the card's diagonal (about six pairs per
   card), and a bold system-font "p" (the logo is the body font at weight 700) sized in
   container units, so a hand-strip back, a deck and the close-up all look alike. Derived
   from the theme tokens; checked in light and dark.
6. ☑ **Scrub buttons explain themselves on hover:** what they do plus the keyboard shortcut,
   the shortcut in muted text.
7. ☑ **Highlights on the opponent's hand strip cards** don't reach the card's left side and
   the corner radius doesn't match the card. Cause: the strip's cards were 2px apart, so
   each card's outline ran over its neighbour's edge and they merged, and the radius was a
   fixed 6px on a ~45px card. Now the cards are 8px apart (padding 4px for the clipping
   strip), with the shared style from 8. The strip as a whole no longer gets an outline
   too; its changed cards do (it's still in the strip's aria label).
8. ☑ **One highlight style everywhere:** hand, deck and discard highlights have sharp
   corners unlike the Active/Bench ones. Every outline around a card matches its radius.
   Cause: those are buttons, and `.board button { border-radius: 0 }` beat `.hit`'s
   radius. Now one rule: 3px accent outline, 1px offset, on a card-sized box with the
   card's own radius (5% / 3.6%), which the outline follows concentrically. Applies to
   hand, hand strip, deck, discard, Lost Zone, Stadium, seen strip, Active/Bench, and
   prizes, which now highlight per card instead of outlining the whole column. Rows where
   several cards can light up together keep at least 8px between cards (hand, strip, seen
   strip, Legendary Stadium pair), so outlines never touch. Checked at actions 3, 4, 5, 7,
   9, 11, 15, 23, 24 and 25, and over all 53 actions at 390×844 that no outline is clipped
   (except hand cards scrolled out of view) and no area changes size. Left as is: Bench
   gaps (0.12 card) are under 8px on phones, so two adjacent highlighted Bench Pokémon can
   touch there.
9. ☑ **Horizontal threshold at the owner's window.** Their current window should just be
   vertical. Measured 1237×1248 with Chrome's "debugging this browser" banner, which takes
   about 40px of height, so ~1237×1285 (ratio ~0.96) without it. Threshold set to 0.97.

## Round 3 (2026-11-25)

1. ☑ **Card back "p" placed by its loop:** the bowl of the "p" sits at the card's centre
   (not the glyph box). Back a little darker overall. Done: the "p" is centred by its bowl
   with `text-box: trim-both ex alphabetic` (the box becomes x-height to baseline, i.e. the
   bowl), plus a 0.01em nudge left; browsers without `text-box` (Firefox) get an offset
   measured on Segoe UI bold. Measured at 1229×1304: bowl centre within 0.1px of the card's
   centre both ways (it was ~5px low). Stripes 38% / 43% text-on-surface in light mode (was
   30% / 35%) and 23% / 28% in dark mode, where less of the light text colour is darker.
2. ☑ **More room for the Stadium.** Vertical view: Stadium closer to the horizontal centre,
   with clear room from the prizes. Horizontal view: prizes move a little further from the
   middle line (vertically) so the Stadium card can be bigger. Done: vertical, the Stadium
   (still ¾ card) sits right of the prize column, 6px clear of the prize count and 10px of
   the column, and the stacks also stay ~21px (390×844), ~55px (480×1000) or ~11px
   (1229×1304) clear vertically. Horizontal, the Stadium is a full card wide (was ¾) and the
   prize stacks start further from the middle line to match, ~8px clear. The caption keeps
   8px from the Stadium; it reserves room for one Stadium card, or two when a Legendary
   Stadium is in play (so it narrows only then). Cost: on a 390px phone the caption pill is
   128px wide (was 140), so "You: Play Festival Grounds" wraps to three lines over the areas.
   Area sizes and Active alignment unchanged over every action of both samples at 390×844,
   480×1000, 1229×1304, 1092×1000 and 1600×1000.
3. ☑ **Hand count centred on the hand's outer side, apart from the name.** The name stays
   in its corner ("You" bottom-left, "Opponent" top-left); "Hand N" is centred below the
   hand from that player's view (bottom player: under the hand; top player: above the
   strip). Done: the label row is a three-column grid, the name at the left and "Hand N" in
   the middle column, centred on the area and the cards (0px off at every size). The bottom
   "Hand N" is the button that opens the list (same accessible name); the top one is part
   of the strip's button as before.
4. ☑ **No seen-card strip for "Reveal starting Pokémon".** The starters are on the board
   already, and the strip overlapped the Active Spots at every game start. Other uses of
   the seen strip stay for now (to be revisited). Done in `replay/steps.ts` by action kind
   (`revealStart`); the revealed starter stays highlighted on the board. Neither sample has
   another seen strip now, so the page test checks its absence there instead.

Noted, not a task: the deck isn't highlighted when cards are drawn or set out as prizes;
fine for now (owner, 2026-11-25).

## Round 4 (2026-11-25, iOS Safari)

1. ☐ **Caption text too big on phones.** The centre action text looks right on desktop but
   on the phone is much bigger than other text on screen. Make it smaller so more fits on a
   line. Likely cause: iOS text autosizing (no `text-size-adjust` was set). Fix: turned off
   site-wide in `index.css`, and the caption is 0.8rem (was 0.9rem) on screens under 40rem.
2. ☐ **Stadium outline cut off on the right** (iOS Safari only; Firefox iOS is fine). Not
   reproduced here (no WebKit on the PC). Guess: Safari clipping an outline inside the
   transformed `.stadium` box. Fix tried: the Stadium is centred on the middle line by flex
   instead of `translateY(-50%)`. Needs the owner's check on the phone.
3. ☐ **Opponent's hand area too narrow;** it cuts off the cards.
4. ☐ **Your hand isn't centred;** it starts at the left and fills to the right.
   Likely cause of 3 and 4: Safari takes a flex item's intrinsic width from its content (the
   card image or back), not from `flex-basis`, so the shrink-to-fit rows came out too narrow
   (backs, no width of their own) or too wide (images, at their own pixel width, so the row
   filled the area from the left). Fix: the hand and strip cards get an explicit `width`.
5. ☐ **Opponent's prizes grow the wrong way** (desktop and iOS). Their board is mirrored,
   so their prize zone starts towards the middle line and grows upwards (on screen); today
   it starts at the top. Fix: the top player's stack is laid out from the bottom of its
   column (`bottom` instead of `top`); the count stays at the bottom right.
6. ☐ **Turn-jump buttons as vector icons.** Replace the previous/next turn emoji with an
   SVG (two arrows and a vertical line), so it looks the same on every device. Fix: all four
   playback buttons use `replay/Icons.tsx` (the ◀ ▶ characters can turn into emoji on iOS
   too). Guideline added.
