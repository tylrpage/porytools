# Replay viewer (visual)

The design for `/replay` as a picture of the table rather than text. Settled with the owner
on 2026-11-24 (`/grill-with-docs`). PTCG Live's portrait and landscape views and Limitless's
tabletop were the references; we borrow their layout ideas, never their art or look.
Terms follow `GLOSSARY.md` (action, change, log, viewpoint, branch).

## Page
- Full width, filling the window height under the site header, so the board never scrolls
  the page. The disclaimer footer stays below it.
- **Toolbar** above the board: sample buttons; "Paste a record" (opens a dialog); a
  **Viewpoint** menu (Everyone / Player 1 / Player 2), shown only for all-seeing records;
  `check` problems as a warning count that expands into the list.
- **Two views, picked automatically** from the window's shape and width, no toggle:
  - **Horizontal** (landscape and wide enough for board plus log): the log is a column on
    the right, always visible. The timeline spans the board's width.
  - **Vertical** (everything else): top to bottom, toolbar; opponent's hand strip;
    opponent's side; Stadium line with the caption; your side; your hand; timeline and
    controls with a **Log** button, at the bottom where thumbs reach. The Log button opens
    the log as a full-height sheet over the board, closed with ✕. Tapping an entry jumps
    to that action and closes the sheet.

## Board
Laid out like the official playmat: prizes left, deck and discard right, the Active Spot in
the centre with the Bench behind it, the Stadium on the middle line. The top player is
mirrored top to bottom only (Active nearest the middle line), so both players' prizes are on
the left and both Active Spots line up. Drawn in porytools' own plain style from the theme tokens (light and dark mode),
with none of Live's art, mat, badge shapes or colours.

- **Who's at the bottom:** the record's viewpoint player. For all-seeing records Player 1,
  unless Viewpoint picks Player 2, which flips the board.
- **Card faces:** the small image from `cards.json` (TCGdex / pokemontcg.io CDN, never
  hosted). No image: a drawn placeholder face with name, HP and type.
- **Card backs:** our own CSS-drawn neutral back, never the official one. Used for the
  deck, prizes, the opponent's hand, unknown cards and face-down Pokémon.
- **Pokémon in play:**
  - Damage as a badge with the damage amount (no remaining-HP figure).
  - Attached Energy as small coloured type circles drawn by us (not the official symbols).
  - Tools as a small card peeking out.
  - Earlier evolution stages barely showing underneath, about a card border's width, just
    enough to see there are cards there.
  - Asleep / Paralyzed / Confused rotate the card as on a real table; Poisoned / Burned get
    markers. Every condition also has a text label (rotation alone isn't accessible).
- **Bench:** one row that shrinks its cards to fit up to 8 (Area Zero Underdepths).
- **Stadium:** a slot two cards wide, since a Legendary Stadium is 2 cards side by side.
  Centred on the middle line, which is only one caption line high, so it reaches into both
  areas; both prize stacks start clear of it.
- **Prizes:** a stack straight down the left side with a count; face up where known
  (all-seeing view).
- **Deck:** a back with its count; a known top or bottom card shows face up on the pile.
- **Discard:** the top card face up with its count. **Lost Zone:** only when not empty,
  next to the discard.
- **Hands:** the bottom player's hand is a row of full-size cards, centred, that scrolls
  sideways when it doesn't fit (like Limitless's tabletop); a vertical mouse wheel over it
  scrolls it too. The top player's hand is a thin centred strip of small backs; known cards
  face up, still small. Each has a one-line label ("You · Hand 7") at the left on the
  player's side of the hand: above the top strip, below the bottom hand.
- **Fixed size:** every row of the board has a fixed height in card sizes, so neither
  player's area changes size during the game (hands arriving, highlights, conditions) and
  the board never shifts while scrubbing. The areas share the spare height, split evenly
  either side of each mat (edge to mat = mat to hand); the grey gap around them is the
  same on all four sides. Special Condition labels sit over the card.
- **Tapping** a pile or a hand opens a list of its cards (with known deck top / bottom).
  Tapping or clicking a card opens a close-up (the small image scaled up). No hover
  previews on the board: the cards are already pictures.
- **The current action:** the cards it moved or changed get an outline, and a one-line
  caption of the action sits over the Stadium line (like Live's banner). Results show where
  cards ended up: Poké Pad highlighted in the discard and the found card in the hand; a
  Stadium in its slot; a Tool on its Pokémon. Cards only looked at or revealed, that don't
  move (Pokégear 3.0's look, a search that finds nothing, a card revealed from hand, an
  opponent's hand revealed), appear as a small strip of cards in the caption, with any
  that stay on the board highlighted. No animation in this pass.
- **Being played:** a played card enters and leaves the pending zone inside one action, so
  there's no display for it. Fallback: if a record ever leaves cards there between
  actions, they show in the centre so nothing silently disappears.
- **Accessibility:** every zone and card has a label ("Active: Dartrix, 20 damage, 1 Grass
  Energy, Asleep"). This replaces the old text board.

## Log
- Oldest first, under turn headers ("Setup", "Your turn 2", "Opponent's turn 2"),
  auto-scrolled to keep the current action in view. Actions after the current one are
  dimmed; tapping any entry jumps there.
- Each entry: a thumbnail of the action's main card (none for e.g. "drew 7 cards"), and the
  sentence with player and card names in each player's colour (theme-derived, both
  modes). The action's changes are behind a chevron, opened automatically on the current
  action. Card names keep their hover preview; thumbnails open the close-up.
- `guessed` / `inferred` actions and changes get a small tag; "guessed" lists the
  alternatives in a tooltip. Nothing on the board for them.
- Branch switches ("↳ branch label", "Back to the main line") stay in the log.
- UI text says "action", never "event".

## Timeline and controls
- **Timeline** in place of the slider: a horizontal bar split into turn segments, each
  tinted with that turn's player colour (Setup neutral). **KO markers** coloured by whose
  Pokémon was Knocked Out; **branch markers** where a branch leaves the line shown. Hover
  or long-press names a marker ("Psyduck Knocked Out").
- A vertical line with a handle marks the current position; drag it, or click the bar to
  jump. It is a real slider for keyboard and screen readers ("Action 12 of 40, Your turn
  2").
- **Buttons:** previous turn (⏮), previous action, next action, next turn (⏭). No
  first/last buttons (owner feedback); Home / End still jump there.
- **Keys:** ← / → step, Shift+← / → jump turns, Home / End.

## Built (choices made while building)
- Player colours go by seat, not by player number: the bottom player is blue, the top one
  red (both modes), so "you" keep one colour when Viewpoint flips the board.
- The Stadium sits near the left of the middle line (half a card in from the edge), with
  the caption centred on the board and kept clear of it.
- The horizontal view needs a window at least 60rem wide with width/height ≥ 0.97. The
  owner's roughly square desktop window (about 0.96) is just on the vertical side.
- The timeline's pointer handling is on the bar; a hidden range input under it is the
  slider for keyboard and screen readers.
- Damage badges are neutral (text colour), so they never read as a player's colour.
- Special Energy is a ringed neutral circle; its name is in the label and the close-up.

## Later
- Sharper close-ups would need a second, large image URL per card (CLAUDE.md allows one
  today). Check on real phones whether the scaled small image is good enough.
- Animation of moves.
