# porytools

A free, non-commercial suite of Pokémon TCG deck-analysis tools at **porytools.com**
(GitHub: `tylrpage/porytools`, public). Scope is tools that need **no strong TCG-playing
bot**: probability calculators, solo "goldfish" setup simulation, a solver that reads a
decklist and finds the lines that reach a user-chosen goal by turn 1–2 (with probabilities
and example lines), and later mid-game analysis from a recorded game state.

Out of scope for now (needs strong bots; revisit later): matchup tables, practice opponents,
full win-probability game review.

Not in scope at all: showing meta information or other people's decklists. Users import
their own lists. Real tournament decklists (fetched from Limitless) are only an internal test
set; store just the decklists, not players, placements or meta shares.

Milestones and status live in `ROADMAP.md`. Keep it updated as work lands.

## Working with the owner
- Knows some TypeScript, is new to Rust, and wants to learn both through this project.
  Briefly explain unfamiliar Rust concepts (ownership, traits, enums, `Result`) where they
  first appear in code or PR notes, but don't slow the work down.
- Plays the game. Treat them as the domain expert and the final reviewer for card effects.

## Constraints
- **Standard format only.** Legality comes from a configurable list of regulation marks,
  not hardcoded per card.
- Keep running costs near zero: static site, all compute client-side, no backend at first.
- Non-commercial fan site. Text only, so do not host card images. Every page carries a
  "not affiliated with Nintendo / The Pokémon Company / Creatures / GAME FREAK" disclaimer.
- The name contains part of a Pokémon trademark (Porygon). Keep the site non-commercial and
  clearly disclaimed.

## Architecture
- **Hosting:** Cloudflare Pages (free), Cloudflare Web Analytics. Domain registered at
  Porkbun, with nameservers pointed to Cloudflare. Backend later only if needed (Workers +
  KV/D1 free tier).
- **Frontend:** TypeScript + Vite + React. Probability calculators (hypergeometric) in pure
  TS.
- **Solver core:** Rust → WASM (`wasm-bindgen` / `wasm-pack`), run in Web Workers (one per
  core). The same crate builds natively for `cargo test` and batch precompute.
- **Testing:** CI runs tests over real tournament decklists (`data/test-decklists.json`,
  fetched from Limitless); later the native solver runs over them as a regression and
  performance suite. Nothing from them is published on the site.
- **Sharing:** decklist (and later game states) encoded in the URL (lz-string / base64 card
  IDs), no server.

## Game state & event log (shared format)
One format serves the solver, the opening analysis, and the future replay recorder/viewer:
- A **game record** is an initial state plus an ordered **event log** (draw, play card,
  attach, evolve, search → result, shuffle, prize taken, attack…). The state at any point
  is a fold over the events, which is what makes scrubbing a replay possible.
- Solver example lines are emitted as event logs, so the replay viewer renders them.
  Mid-game analysis starts from any state in a record.
- States must represent **hidden information** explicitly: deck = known multiset with
  unknown order (or known order after a reveal), prizes = unknown / partially known,
  opponent hand = count only. The solver may only branch on what the player knows.
- Rust is the source of truth for the types (serde). TS types are generated from it, not
  hand-written twice. The format gets a version field from day one.
- Design the exact format together with the owner before coding it (ROADMAP M3).

## Goals (solver targets)
A small, composable goal language rather than hardcoded checks. Start with:
- "Pokémon X (or any of a set) is in play", with counts and Active/Bench location.
- "Pokémon X is Active with attack Y payable" (attached energy satisfies the cost).
- `and` / `or` combinators, plus a turn bound and going first/second.
Leave room for later goals (cards in hand, cards in discard, damage dealt).

## Card data
- Source: PokemonTCG/pokemon-tcg-data JSON (backs pokemontcg.io), with TCGdex as an
  alternative and a local override file for new sets the source hasn't added yet.
- Fetched at **build time** only and filtered to Standard-legal into a compact `cards.json`.
- Needs a mapping from PTCG Live set codes (e.g. `TWM 128`) to data IDs (e.g. `sv6-128`).
  Collapse reprints with identical game text.
- The decklist parser accepts PTCG Live export and Limitless formats.

## Card effects (the hard part)
- Never parse card text with an LLM at runtime. Translate offline into a small effect DSL of
  ~30–50 primitives (draw, search(zone, filter, count, dest), discard, attach_energy,
  evolve, switch, bench, shuffle, plus conditions like going-second / once-per-turn).
- Each card's effect is data (e.g. YAML) with per-card tests. Pipeline: regex templates for
  boilerplate text → coding-agent drafts for the rest → owner review.
- Each card has a status: `verified` / `draft` / `unsupported`. The UI must surface
  unmodeled cards ("treated as blank").
- Coverage is driven by 2–3 chosen meta decks first, so the first card set is solid.
- Attacks initially need only energy cost and usability conditions. Damage math comes later.

## Solver correctness rules
- **No clairvoyance.** Sampling a shuffle and asking "does any line exist?" lets the search
  see deck order and prizes, which the player cannot, so it overestimates. Model draws as
  chance nodes and searches as decisions (expectimax). Prizes are unknown to the player.
  Deck order is unknown again after any shuffle.
- Practical reporting: lower bound (reasonable fixed policy) + upper bound (clairvoyant).
- Performance: hands as multisets, transposition tables, dominance pruning, early exit.
- Rules to get right from day one: going first can't play a Supporter or attack on T1;
  mulligans; prizes are set aside after the opening hand; once-per-turn limits.
- Show sample lines alongside odds.
- Validate Monte Carlo against exact hypergeometric results on simple decks.
