# porytools roadmap

No deadlines; ordered by dependency. Each milestone ends with something shippable on
porytools.com. Status: ☐ todo · ◐ in progress · ☑ done.

---

## M0 — Foundations ☑
Repo, toolchain, and a live (empty) site.
- ☑ `git init`, remote `tylrpage/porytools`, `.gitignore`, MIT license, README with
  disclaimer
- ☑ Vite + React + TypeScript app; Vitest; oxlint (the Vite template's default, used in
  place of ESLint) + Prettier
- ☑ Monorepo layout: `web/` (site), `solver/` (Rust crate, added in M4), `data/` (card
  pipeline), `effects/` (card effect YAML)
- ☑ GitHub Actions CI: typecheck, lint, format check, test, build on every PR and push to
  `main`
- ☑ **[owner]** Cloudflare: add `porytools.com` as a zone, then switch the Porkbun
  nameservers to the two Cloudflare ones
- ☑ **[owner + me]** Cloudflare Pages project connected to the GitHub repo (build
  `web/`, root dir `web`, output `dist`, `NODE_VERSION=24`), custom domain, Web Analytics.
  Every push to `main` deploys.
- ☑ Site shell: header/nav, footer disclaimer, About page, 404

## M1 — Card data & decklist import ◐
- ☑ Build script (`web/scripts/cards/`, `npm run cards`): fetch pokemon-tcg-data, filter by
  legal regulation marks (`data/config.json`: `oldestLegalMark`, now `H`), emit compact
  `web/public/data/cards.json` (committed; one card per line for reviewable diffs)
- ☑ Set-code → data-ID mapping (upstream codes + aliases); reprint collapsing by game text
  (older prints legal through a reprint); basic Energy as one always-legal card per type
- ☑ One display print per card (newest regular rarity): promos, full arts and older prints
  map to it in the UI and (later) the solver; share links and exports keep the listed
  prints
- ☑ Print IDs follow PTCG Live (`TWM-128`), independent of the data source
- ☑ TCGdex adapter for sets pokemon-tcg-data lacks (MEE, MEP); fallback source if it
  stops adding sets (pokemon-tcg-data is deprecated; Scrydex ruled out: paid, no
  redistribution)
- ☑ `data/overrides.json`: patches for upstream gaps (4 so far) + new sets/cards
- ☑ Decklist parser: PTCG Live export + Limitless text; errors with line numbers;
  60-card / 4-copy (by name) / 1-ACE-SPEC / Basic Pokémon / legality validation
- ☑ Deck view page (`/deck`: grouped Pokémon / Trainer / Energy, counts, problems)
- ☑ Decklist ↔ URL encoding (`/deck?d=2.4_TWM-128…`, versioned, prints as listed)
- ☑ Decklist remembered in localStorage, shared by `/deck` and `/odds` (survives
  navigating away and reloads; opening a share link replaces it)
- ☑ **[owner]** Review: overrides approved, PTCG Live import worked
- ☑ Real-decklist test set (`npm run fetch-decklists` → `data/test-decklists.json`):
  decklists only, from top Limitless archetypes, for internal tests; all 50 parse and
  validate
- ☑ Card images: `cards.json` has one small-image URL per card, linked, never hosted.
  TCGdex scans (~15 KB webp) of the best print that has one (display print first), checked
  to exist at build time (`scripts/cards/images.ts`); pokemontcg.io as fallback; Scrydex
  links dropped (terms not cleared). 2156 TCGdex, 1 fallback, 19 MEP promos without a scan
- ☑ Hover / tap a card name to see the card (`CardName`) in the odds and deck tables;
  faint dotted underline marks it
- ☐ Refresh `cards.json` automatically (scheduled GitHub Action opening a PR) when sets
  release
- ☐ Later: "before / after rotation" toggle on the site (the data already supports it)

## M2 — Probability calculators (first public release) ☑
All exact math in pure TS (`web/src/odds/`), unit-tested against brute force on small decks,
closed-form hypergeometric values, and Monte Carlo; timed over the 50 real test decklists.
One engine deals hand, prizes and draws together (exact counting over "piles" of cards),
so every number below is exact.
- ☑ Mulligan chance (opening-hand odds and expected mulligans dropped in review: the
  opening hand only matters for mulligans)
- ☑ Opening hand **conditioned on no mulligan** (the opener always has a Basic); a toggle
  switches to plain first-7 odds
- ☑ Prizes: P(n copies prized), P(all copies prized), per-card table
- ☑ By-turn-N: P(seen card/group by your turn N) (prized cards can't be drawn; both
  players draw on their first turn, so turn order doesn't change these odds)
- ☑ Card groups: built-ins (Basic Pokémon, Pokémon, Supporters, Items, Tools,
  Stadiums, Energy, Basic Energy) and custom groups; questions over several cards and
  groups, as "and" of parts with "or" alternatives: (A or B) and C
- ☑ **[owner]** First review: no opening-hand column (it only matters for mulligans),
  turns start at 1, both players draw on turn 1, no draw-Supporter group
- ☑ Card order everywhere (`deck/order.ts`): sections, then count and name; Pokémon in
  evolution lines, basic first, lines by total copies
- ☑ **[owner]** Design guidelines (`docs/ux-guidelines.md`) and requested changes;
  polish checked on a real phone (iPhone Safari); owner accepted the milestone
- ☐ Later: share links that carry custom groups and questions (the decklist link already
  works)

## M3 — Game state & event-log format (design with owner) ◐
The foundation for the solver output, replays, and mid-game analysis.
- ☑ Design session (2026-11-24): spelled-out changes are the truth (no card effects needed
  to fold); per-record viewpoint (player or all-seeing, projectable); tree of nodes for
  branches; state = table + history, everything else is a query; one global turn number
  (UI shows "Your turn N"); attacks by position; instances only while trackable (deck =
  pool, shuffle ends instances); `guessed` / `inferred` flags; no usernames
- ☑ Spec (`docs/game-format.md`) with worked examples: opening setup, a T1 with a branch,
  and a real PTCG Live game hand-converted (tests the format against Live's partial info).
  Includes the **state and query registry** (every stored fact and query, and which cards
  need it). **[owner]** reviewed
- ☑ Rust crate (`solver/`) builds native + WASM (`wasm-pack`, `npm run wasm`; `npm run
  build` builds it first, installing Rust on CI / Cloudflare Pages); the site loads it
  (`web/src/game/solver.ts`, tested from Vitest). CI: rustfmt, clippy, `cargo test`, TS
  types current. Claude Code hooks: rustfmt on edit, clippy at stop (moved up from M4)
- ☑ Rust types (serde) + TS types generated with `ts-rs`; fold, consistency check (all
  branches), projection; tests: round trip, fold and projection over the spec's examples and
  the owner's full Live game (`solver/tests/fixtures/`), plus bookkeeping and error cases
- ☑ **[owner]** First deploy with the WASM build (Cloudflare installs Rust fine)
- ☑ WASM size checked: 440 KB, 140 KB gzipped, ~110 KB brotli (what Cloudflare sends).
  About a third is serde buffering for the record format's flattened, `type`-tagged JSON.
  `opt-level = "s"`/`"z"` saves only ~15–20% compressed and would slow the future solver,
  `wasm-opt -Oz` and parsing via `serde_json::Value` save nothing, so it stays as is.
  Revisit in M4 if needed (e.g. a separate small build for the viewer)
- ☑ Minimal replay viewer (`/replay`, `web/src/pages/Replay.tsx`): sample records (the Rust
  fixtures) or a pasted one; first / back / next / last buttons and a slider; the current
  event with its changes; the board as text for both players (Active and Bench with HP,
  conditions and attachments, hand, deck, prizes, discard, Stadium); an event list by turn
  ("Your turn 2"), with buttons to switch to a branch and back; all-seeing records can be
  shown as either player sees them (projection); `check` errors listed. The page is a lazy
  route, so only it downloads the WASM
- ☑ Visual replay viewer designed with the owner (2026-11-24): `docs/replay-viewer.md`
- ☑ Visual replay viewer (replaces the text board), per `docs/replay-viewer.md`
  (`web/src/pages/Replay.tsx`, `web/src/replay/`):
  - ☑ Full-width page, toolbar (samples, paste dialog, Viewpoint, `check` count),
    automatic horizontal (log column) / vertical (Log sheet) views
  - ☑ Board: playmat layout in our own look, card images and CSS backs, Pokémon with
    damage, Energy, Tools, evolution edge and conditions; Bench up to 8; two-wide Stadium;
    prize fan; piles and hands (scrolling hand) with card lists; close-up on tap;
    highlight + caption for the current action; aria labels
  - ☑ Log: chronological by turn, thumbnails, player colours, changes behind a chevron,
    `guessed` / `inferred` tags, branches
  - ☑ Timeline: turn segments, KO and branch markers, draggable position; turn jumps and
    keyboard keys
  - ☐ Check on real phones whether the small card images are sharp enough for close-ups
    (else add a large image URL per card)
- ☐ **[owner]** Review the visual replay viewer (desktop and phone, both views, wording)
  - ☑ Round 1 feedback (9 layout items; one not reproduced): `docs/replay-feedback.md`
  - ☑ Round 2 feedback (9 items): same file
  - ☑ Round 3 feedback (4 items): same file
  - ☐ Round 4 feedback (7 items, iOS Safari): same file

## M4 — Rust solver core (goldfish simulator) ☐
- ☐ Solver runs in a Web Worker (the crate itself is set up in M3)
- ☐ Queries (`queries.rs`, the spec's registry) over state + history, with card data
- ☐ Rules engine: setup (Basics, mulligans, opponent's extra draws ignored for solo),
  prizes, turn structure, going first restrictions, supporter/energy/retreat
  once-per-turn, evolution timing
- ☐ Effect DSL v0 + core cards: Basic Energy, Nest Ball, Ultra Ball, Buddy-Buddy Poffin,
  a draw Supporter, Rare Candy, plus a couple of Basics/evolutions
- ☐ Once the DSL settles: a project Claude Code skill (`.claude/skills/`) for card-effect
  authoring (YAML shape, per-card test, status rules, review checklist), used through M5
- ☐ Goal language v0: "Pokémon X in play", counts, Active/Bench, and/or, by turn N
- ☐ Fixed heuristic policy Monte Carlo (**lower bound**) and clairvoyant search (**upper
  bound**)
- ☐ Validation: on decks with no search cards, Monte Carlo matches M2's exact numbers
- ☐ Output: probabilities + sample lines as M3 event logs, viewable in the replay viewer

## M5 — Meta deck coverage ☐
- ☐ Owner picks 2–3 current meta decks
- ☐ Model every card in them: regex templates → agent drafts → owner review →
  `verified`. Per-card tests.
- ☐ Goal v1: "Pokémon X Active with attack Y payable"
- ☐ UI shows each card's status and "treated as blank" warnings
- ☐ Ship "setup odds" for those decks

## M6 — Proper solver (no clairvoyance) ☐
- ☐ Expectimax: draws/shuffles as chance nodes, choices as decisions, prizes hidden
- ☐ Multiset hands, transposition tables, dominance pruning, early exit
- ☐ Report optimal-play probability with a best line and alternative lines; keep the
  lower/upper bounds for comparison
- ☐ Performance budget: typical deck T2 query in seconds in the browser across workers

## M7 — Real-deck regression suite (internal) ☐
The site never shows meta data or decklists: users import their own lists. Real tournament
lists are only a test set.
- ☑ Fetch decklists from Limitless for tests (done in M1)
- ☐ CI runs the native solver over the test decklists: no crashes, results stable across
  changes, a performance budget per deck
- ☐ Report which cards in the test decklists are unmodeled, to steer M5 effect coverage
- ☐ Refresh the test set on new sets

## M8 — Mid-game analysis ☐
Analysis always runs on a state inside a full game record (from the start of the game), so
every query has its history. No standalone "current board + extra facts" states.
- ☐ Tools that help build a record reaching a wanted position (e.g. set up a board, then
  fill in a plausible history), scoped when we get here
- ☐ Solver runs from any state in a record toward a goal this turn / by next turn
- ☐ Goals v2: cards in hand/discard, damage thresholds (begin damage math)

## M9 — Game recorder & replays ☐
- ☐ Tool to record a real game into the M3 format (manual entry UI first)
- ☐ PTCG Live battle-log import (feasible: see "What a Live import needs" in
  `docs/game-format.md`): sentences → actions, rule-implied events, names → prints by
  decklist / attacks / HP, copies by constraints else `guessed`, known effects added as
  `inferred`
- ☐ "Analyze from here" in the replay viewer (built in M3) opens M8 on any moment
- ☐ Shareable replay links

---

## Open questions
- Basic Energy spellings seen: PTCG Live `Basic {G} Energy SVE 1`, Limitless
  `Psychic Energy MEE`.
- Does pokemon-tcg-data add the next set (likely January)? If not, switch new sets to
  TCGdex.
- Which meta decks to target first (M5).
