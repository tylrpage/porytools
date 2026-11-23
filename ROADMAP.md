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
- ◐ **[owner]** Review: overrides approved, first PTCG Live import worked; a few more real
  Limitless exports would be good
- ☐ Refresh `cards.json` automatically (scheduled GitHub Action opening a PR) when sets
  release
- ☐ Later: "before / after rotation" toggle on the site (the data already supports it)

## M2 — Probability calculators (first public release) ☐
All exact math in pure TS, unit-tested against brute force on small decks.
- ☐ Opening hand: P(at least k of card/group in the opening 7), mulligan rate, expected
  mulligans
- ☐ Opening hand **conditioned on no mulligan** (the opener always has a Basic)
- ☐ Prizes: P(n copies prized), P(all copies prized), per-card table
- ☐ By-turn-N: P(seen card/group by turn N), going first vs second (accounting for
  prizes and the first-turn draw)
- ☐ Card groups ("any Basic", "any draw Supporter", custom groups)
- ☐ Polish + launch: mobile layout, share links, analytics on

## M3 — Game state & event-log format (design with owner) ☐
The foundation for the solver output, replays, and mid-game analysis.
- ☐ Design session: zones, card instances vs card IDs, hidden information, event types,
  versioning, compact encoding
- ☐ Write the spec (`docs/game-format.md`) with worked examples: an opening setup and a
  T1–T2 sequence
- ☐ Rust types (serde) + generated TS types; round-trip tests
- ☐ Minimal replay viewer in the site: load a record, scrub events, see the board as text.
  Hand-written sample records only at this point.

## M4 — Rust solver core (goldfish simulator) ☐
- ☐ Rust crate builds native + WASM (`wasm-pack`); runs in a Web Worker; CI runs
  `cargo test`
- ☐ Rules engine: setup (Basics, mulligans, opponent's extra draws ignored for solo),
  prizes, turn structure, going first restrictions, supporter/energy/retreat
  once-per-turn, evolution timing
- ☐ Effect DSL v0 + core cards: Basic Energy, Nest Ball, Ultra Ball, Buddy-Buddy Poffin,
  a draw Supporter, Rare Candy, plus a couple of Basics/evolutions
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

## M7 — Precomputed meta results ☐
- ☐ Scrape/import top Limitless decklists
- ☐ GitHub Actions runs the native solver and commits/publishes static JSON
- ☐ Meta deck pages load instantly; recompute on new sets / card-effect changes

## M8 — Mid-game analysis ☐
- ☐ Board-state editor that produces an M3 state (hand, board, discard, known deck info,
  prizes known/unknown)
- ☐ Solver runs from an arbitrary state toward a goal this turn / by next turn
- ☐ Goals v2: cards in hand/discard, damage thresholds (begin damage math)

## M9 — Game recorder & replays ☐
- ☐ Tool to record a real game into the M3 format (manual entry UI first; investigate
  importing the PTCG Live battle log)
- ☐ Replay viewer with scrubbing; "analyze from here" opens M8 on any moment
- ☐ Shareable replay links

---

## Open questions
- Basic Energy spellings seen: PTCG Live `Basic {G} Energy SVE 1`, Limitless
  `Psychic Energy MEE`.
- Does pokemon-tcg-data add the next set (likely January)? If not, switch new sets to
  TCGdex.
- Exact game-record format (M3 design session).
- Which meta decks to target first (M5).
