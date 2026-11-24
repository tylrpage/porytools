# Game record format (v1)

One format for solver output, replays, imported games, and mid-game analysis. Decided with
the owner in the M3 design session (2026-11-24); this file is the spec. The Rust types in
`solver/src/game/` (serde) are the source of truth, and the TS types in
`web/src/game/types/` are generated from them (ts-rs).

## Decisions

| Topic | Decision |
|---|---|
| Truth | A record **spells out every change** (what moved where, what was revealed). Applying it needs card *data* (names, kinds, stages) but never card *effects*, so unmodeled cards, manual recordings and Live imports all load. Legality is checked separately by the engine (M4+), never by the fold. |
| Viewpoint | Each record has a `viewpoint`: player `0`, player `1`, or `"all"`. Events hold only what that viewer learned. An `"all"` record (solver, sims) can be **projected** to one player's view. |
| Branching | A record is a **tree** of nodes. The state at a node is the fold of the path from the start to it. Linear records need no extra syntax. |
| Card identity | Cards are **instances** only while they can be tracked. The unordered part of a deck is a pool of counts, and a shuffle ends instances (no one can know it's "the same Pidgey" afterwards). |
| Copies | When a source doesn't say which copy (or which print), pick one and flag it `guessed`, listing the alternatives. Copies that can't be told apart (same card, same state) are not guesses. Events the source never states, but the rules or a known card effect imply, are flagged `inferred`. |
| Players | Always two. A goldfish opponent is an empty placeholder. No usernames: the UI says "You" / "Opponent" from the viewpoint (or "Player 1/2" for `"all"`). |
| Derived facts | **State is the table plus the history; everything else is a query.** The state stores only what's physically on the table (zones, stacks, damage counters, Special Conditions). "Supporter played this turn", "came into play this turn", "KO during your opponent's last turn", "under Itchy Pollen" are Rust query functions over the state and its history, like Pichu's `CardQueries`. New card conditions are new code, not new stored fields. |
| Turns | Stored as **one global number**: turn 1 is the first player's first turn, turn 2 the second player's first, and so on (0 = setup). The UI always shows the player's own count, "Your turn 2", as players say it and as the odds page uses it. |
| Attacks, Abilities | Attacks by **position** on the card (`"attack": 1`), shown by name. A Pokémon has at most one Ability, so using it needs no index. |
| Start | A record **always starts from a new game**: just the two decks. Setup (coin flip, hands, mulligans, prizes) is logged as events, so every state has its full history and every query can be answered. Analysis always runs on a state inside a full record; tools that build a record reaching a wanted position come later. There are no mid-game snapshots with extra facts attached. |
| Cards | Referenced by print ID **as listed** (`TEF-23`), resolved with `CardDb.cardOfPrint`, like share links. Cards with no known print (an opponent's) use the display print. |
| Fold | Rust, compiled to WASM for the site, so the solver and the viewer share one implementation. |
| Encoding | Canonical form is JSON (below). A compact URL encoding comes with share links (M9). |

## Record

```jsonc
{
  "format": "porytools-game",
  "version": 1,
  "viewpoint": 0,                 // 0 | 1 | "all"
  "source": "ptcgl-import",       // "solver" | "manual" | "ptcgl-import" | "handwritten"
  "players": [
    { "decklist": [["TEF-23", 1], ["PRE-9", 4]] },   // optional; usually only the viewer's
    {}
  ],
  "start": { /* the two decks; see State below */ },
  "nodes": [ /* Node, in order */ ]
}
```

Readers reject an unknown `format` or a `version` above what they know. Bump `version` on any
change old readers would misread, and add a migration from the previous version.

### Nodes (the tree)

```jsonc
{ "action": { /* Action */ } }                         // child of the previous node
{ "parent": 12, "label": "Alternative: Nest Ball first", "action": { … } }
{ "parent": null, "action": { … } }                    // child of the start state
```

- `parent` defaults to the previous node (the first node's default is the start), so a linear
  record is just a list of actions. `parent` must point to an earlier node.
- The **main line** follows each node's first child. Other children are branches, optionally
  with a `label`. Solver results (probabilities at a node) can go in an `annotations` object
  later; readers ignore keys they don't know.
- A branch can be a choice (a different decision) or chance (a different draw); which one
  follows from the action.

## Actions and changes

An **action** is one main entry: something a player did, or a rule step. It carries a list of
**changes**, which are the only thing that alters the state. This matches PTCG Live's
battle log (main entry + sub-entries) and its engine (`PlayerOperation` → `ActionModification`s).

```jsonc
{ "type": "playCard", "player": 0, "card": 1, "changes": [ … ] }
```

Every action and change may also have:
- `"flag": "inferred"`: not in the source, implied by the rules or by a known card effect.
- `"flag": "guessed"` with `"alternatives": [...]`: the source was ambiguous; the other
  candidates (instance IDs or prints) are listed so the UI can offer a fix.

### Action types

| Action | Fields | Notes |
|---|---|---|
| `openingCoinFlip` | `caller`, `call` (`heads`/`tails`), `winner` | |
| `chooseFirst` | `player` (who chose), `first` | Sets who goes first. |
| `openingHand` | `player` | Draw 7. |
| `mulligan` | `player` | Reveal, shuffle back, draw 7. |
| `placeStart` | `player` | Face-down Active and Bench. |
| `setPrizes` | `player` | 6 face-down prizes. |
| `mulliganDraws` | `player`, `count` | "May draw a card for each *extra* mulligan their opponent took"; drawn Basics may go to the Bench. |
| `revealStart` | | Flip the starting Pokémon face up. |
| `startTurn` | `player` | Includes the draw for turn (or the deck-out loss). |
| `playCard` | `player`, `card` | Item, Supporter, Stadium, or Tool. |
| `playBasic` | `player`, `card` | To the Bench from hand. |
| `evolve` | `player`, `card`, `onto` | |
| `attachEnergy` | `player`, `card`, `onto` | The once-per-turn attachment from hand. Attachments by effects are changes inside other actions. |
| `retreat` | `player`, `pokemon`, `to` | |
| `useAbility` | `player`, `pokemon` | The Ability of the Pokémon's top card (at most one per card). |
| `trigger` | `player`, `card` | Effects that fire by themselves (on play, on KO…). |
| `attack` | `player`, `pokemon`, `attack` (position), `from`? | Position in the top card's attacks; `from` is the Tool that grants it (Technical Machine: Fluorite, Core Memory, Mega Rayquaza Cap), indexing that card's attacks. |
| `checkup` | | Pokémon Checkup between turns. |
| `knockOut` | `pokemon` | How it happened is a query: a KO right after an `attack` is "by an attack", inside `checkup` it's from Checkup. |
| `takePrizes` | `player`, `count` | |
| `promote` | `player`, `pokemon` | New Active after a KO. |
| `endTurn` | `player` | Usually `inferred` after an attack. |
| `endGame` | `winner` (`0`/`1`/`null` for a tie), `reason` | `reason`: `prizes`, `noPokemon`, `deckOut`, `concede`, `other`. |

### Change types

`Loc` is a location (below). `NewCard` is `{ "id": 14, "card": "MEE-1" }`, or `{ "id": 14 }`
when its identity is unknown to the viewer.

| Change | Fields | Effect |
|---|---|---|
| `draw` | `player`, `cards: NewCard[]` | From the top of the deck (known top cards first) to hand. |
| `fromDeck` | `player`, `cards: NewCard[]`, `to: Loc`, `seen`? | Search or look: takes cards from the pool. |
| `move` | `cards: id[]`, `to: Loc` | Moves exactly those instances. |
| `toDeck` | `cards: id[]`, `pos` (`pool`/`top`/`bottom`) | Into the pool ends the instances. |
| `shuffle` | `player` | Known top and bottom cards rejoin the pool; their instances end. |
| `reveal` | `cards: { id: print }`, `to` (`0`/`1`/`all`) | Makes identities known. |
| `lookAtDeck` | `player`, `contents: [print, count][]` | The viewer sees the whole deck (e.g. a search). |
| `switch` | `player`, `bench: id` | Swaps the Active with that Benched Pokémon. |
| `damage` | `pokemon`, `amount` | Damage, after Weakness and Resistance. Stored as counters. |
| `counters` | `pokemon`, `count` | Damage counters placed directly. |
| `heal` | `pokemon`, `amount` | |
| `condition` | `pokemon`, `add`? / `remove`? | `asleep`, `confused`, `paralyzed`, `poisoned`, `burned`. |
| `coinFlip` | `result` | |
| `choose` | `what`, `value` | A choice that changes nothing on the table but that later queries need, e.g. "choose a type" for a damage-prevention effect. |

`seen` on `fromDeck` (only in `"all"` records): who saw the cards, `owner` (default) or
`all` (the card says "reveal it"). Projection uses it. In a player-view record it is
omitted: if a change names a card, the viewer saw it.

### Locations

```jsonc
{ "zone": "hand", "player": 0 }
{ "zone": "deck" }          // the pool; also "deckTop", "deckBottom"
{ "zone": "active" }  { "zone": "bench" }  { "zone": "discard" }  { "zone": "prizes" }
{ "zone": "lostZone" }  { "zone": "stadium" }   // a Legendary Stadium is 2 cards, played together
{ "zone": "pending" }       // being played or looked at, like Live's *Pending positions
{ "zone": "stack", "on": 15 }      // evolve: goes on top of that Pokémon
{ "zone": "attached", "on": 15 }   // Energy, Tools
```

`player` defaults to the card's owner. A Pokémon in play is referenced by **any card in its
stack** (canonically the bottom card, which survives evolution).

## State

The fold's output. A record's `start` is a new game, so it holds only the two decks (Rust
`Start`); everything else starts empty, zero, or `null`:

```jsonc
"start": {
  "players": [
    { "deck": { "count": 60, "contents": [["TEF-23", 1], ["PRE-9", 4] /* … */] } },
    { "deck": { "count": 60 } }
  ]
}
```

```text
State
  phase          setup | play | ended
  firstPlayer    0 | 1 | null
  turn           n                             global: 0 setup, 1 = first player's T1, 2 = second player's T1…
  cards          id → { owner, card: print | null }   every live instance
  players[2]     PlayerState
  stadium        id[]                          0, 1, or 2 (Legendary Stadium) cards; owner = the cards' owner
  result         { winner, reason } | null
  history        the actions so far (the path from the start), indexed by turn

PlayerState
  deck           { top: id[], count, contents: [print, count][] | null, bottom: id[] }
  hand           id[]
  active         Pokemon | null
  bench          Pokemon[]                     order is display only
  discard        id[]                          oldest first
  prizes         id[]
  lostZone       id[]
  pending        id[]
  mulligans      n

Pokemon
  stack          id[]                          bottom → top; top is the Pokémon
  attached       id[]
  counters       n                             damage counters (damage = 10 × counters)
  conditions     { rotation: asleep|confused|paralyzed|null, poisoned, burned }
  faceDown       bool                          during setup
```

`deck.contents` is the pool's exact contents when the viewer knows them (their own deck in a
new game, or after `lookAtDeck`), else `null`. What a player's unknown cards *could* be (deck
pool, prizes, the opponent's hand) is derived: decklist minus every known instance.

### Automatic bookkeeping

The fold applies these rulebook facts itself, because no card changes them:
- A Basic moved into the Active Spot or Bench from outside play becomes a new Pokémon.
- A card moved onto a `stack` (evolving), or a Pokémon moving to the Bench, clears its
  Special Conditions ("When a Pokémon evolves or moves to the Bench, it recovers from all
  Special Conditions").
- Moving a card of a Pokémon's stack to the Active Spot or the Bench moves the whole
  Pokémon (promote, Switch effects); `switch` swaps the Active with a Benched Pokémon.
- When a Pokémon has no cards left (stack and attachments), it is removed with its counters.
  A KO can move the stack and the attachments in separate changes.
- Pokémon put into play during setup, before `revealStart`, are face down; `revealStart`
  flips them after its `reveal` changes.
- `startTurn` advances `turn`; `mulligan` counts toward `mulligans`; `chooseFirst` sets
  `firstPlayer`; `endGame` sets `result`.
- `toDeck` with `top` lists cards top first (the first listed ends on top); `bottom` lists
  them top to bottom. Drawing takes known top cards first: the drawn `NewCard` must name
  that instance.
- Healing more than a Pokémon's damage heals it to 0. Damage must be a multiple of 10.

Effects of attacks also end when a Pokémon evolves or goes to the Bench. Those effects
aren't stored, so this is handled in the queries (below), not by the fold.

The fold checks only **consistency**, after each action: every instance is in exactly one
place, IDs are unused when created, counts never go negative, known deck contents match
the pool and hold every card taken from it, a revealed card keeps its identity, and cards
in public zones (in play, discard, Lost Zone, Stadium) have known identities (face-down
setup Pokémon excepted). It does not check legality. A card leaving a known pool unseen
(e.g. face-down prizes) makes the pool's contents unknown again.

### Queries

Everything the rules or a card asks about that isn't on the table is a **query**: a Rust
function over the state and its history (`queries.rs`, after Pichu's `CardQueries`).
Examples:
- `supporter_played(state)`: this turn's history has a `playCard` of a Supporter.
- `entered_play_turn(state, pokemon)`: the turn of the change that put its bottom card into
  play. Evolution legality uses it.
- `items_locked(state, player)`: during that player's turn, the opponent's previous turn
  used Budew's Itchy Pollen. Nothing is stored; knowing Budew's attack is enough.
- `knocked_out_last_turn(state, player)`: a `knockOut` of that player's Pokémon during the
  opponent's previous turn (Fezandipiti ex).
- `paralysis_ends(state, pokemon)`: when Paralyzed was added, so it recovers after its
  owner's next turn.

Queries are the only way rules code and card effects read derived facts. A query may cache
(the solver will want per-turn summaries), but callers never know.

## Projection (`"all"` → one player)

`project(record, player)` returns that player's view: identities they didn't see become
unknown (opponent's draws, prizes, `fromDeck` without `seen: all`), `lookAtDeck` by the
opponent is dropped, and `deck.contents` follows the same rule. Each change type has a
default for who sees it: `draw` → owner, `fromDeck` → `seen` (into prizes: no one, they're
face down; into a public zone: everyone), `reveal` → `to`. When a card the player hadn't
seen enters a public zone or their own hand or pending zone (a prize taken, the opponent's
played card), projection adds a `reveal` (to `all` or to the player), so the projected
record still folds. The opponent's decklist is dropped.

## State and query registry

**Every fact the state stores, and every query, with what needs it.** When a new card
needs something that isn't here, that's a code change: usually a new query (add a row,
then the Rust function and its test); rarely new table state (only for something physical
on the table). The card-effect authoring skill (M4) points here.

### Stored (the table)

| Fact | Where | Needed by |
|---|---|---|
| Deck pool count, known top/bottom, known contents | `PlayerState.deck` | Draws, searches, Recon Directive (bottom), deck-out |
| Hand, discard, Lost Zone, prizes | `PlayerState` | Every zone rule; Lost Zone (out of play, rulebook appendix 8) |
| Pending zone | `PlayerState.pending` | Cards being played or looked at (Recon Directive's 2) |
| Mulligan count | `PlayerState.mulligans` | Opponent's extra draws |
| Evolution stack, attachments | `Pokemon` | Evolution, KO discards, Energy costs, Tools (incl. attacks granted by Tools) |
| Damage counters | `Pokemon.counters` | KOs, damage goals (M8) |
| Special Conditions | `Pokemon.conditions` | Checkup; Asleep/Confused/Paralyzed replace each other, Poisoned/Burned stack |
| Face-down during setup | `Pokemon.faceDown` | Setup |
| Who goes first, global turn | `State` | Whose turn; going first: no Supporter, no attack on turn 1 |
| Stadium cards in play | `State.stadium` | Replacing it discards to the owner's discard; Legendary Stadiums are 2 cards |
| Result | `State.result` | Win by prizes / no Pokémon / deck-out; ties (Sudden Death) |
| History | `State.history` | Every query below |

### Queries (from table + history)

| Query | Reads | Needed by |
|---|---|---|
| Supporter / Stadium played, Energy attached, retreated this turn | This turn's actions | Once-per-turn rules |
| Turn a Pokémon came into play / last evolved | Changes that moved its cards into play | No evolving on its first turn in play or twice in a turn; no evolving on either player's first turn |
| Ability used this turn (per Pokémon; per Ability name) | This turn's `useAbility` | "Once during your turn"; Fezandipiti ex "can't use more than 1 Flip the Script Ability each turn" |
| Attacks used | `attack` actions | "If this Pokémon used X during your last turn" |
| Cards played this turn | `playCard`, `playBasic`, `evolve` | "If you played X this turn" |
| KOs during a turn, and how | `knockOut` and the action before it | Fezandipiti ex Flip the Script (KO during opponent's last turn); "Knocked Out by damage from an attack" |
| Items locked | Opponent's last turn: Budew Itchy Pollen | Budew (ASC-16) |
| Paralysis ends | When Paralyzed was added | Checkup: recovers after its owner's next turn |
| Prizes remaining | `PlayerState.prizes` | Lillie's Determination (8 cards with exactly 6 left) |

## Worked examples

IDs are numbered for readability (player 0's cards 1–99, player 1's 101+); the format only
needs them unique. Changes that a reader can infer are still written out, because changes
are the truth.

### 1. Opening setup (solver, `"all"`)

Going first with a single Basic in hand; prizes known because the record is all-seeing.

```jsonc
{ "format": "porytools-game", "version": 1, "viewpoint": "all", "source": "solver",
  "players": [{ "decklist": [["PRE-9", 4], /* … 60 cards */] }, {}],
  "start": { "players": [{ "deck": { "count": 60, "contents": [/* the decklist */] } },
                         { "deck": { "count": 0 } }] },
  "nodes": [
    { "action": { "type": "chooseFirst", "player": 0, "first": 0, "changes": [] } },
    { "action": { "type": "openingHand", "player": 0, "changes": [
      { "type": "draw", "player": 0, "cards": [
        { "id": 1, "card": "PRE-9" }, { "id": 2, "card": "30C-126" }, { "id": 3, "card": "MEE-1" },
        { "id": 4, "card": "MEE-1" }, { "id": 5, "card": "PRE-10" }, { "id": 6, "card": "ASC-192" },
        { "id": 7, "card": "PRE-108" } ] } ] } },
    { "action": { "type": "placeStart", "player": 0, "changes": [
      { "type": "move", "cards": [1], "to": { "zone": "active" } } ] } },
    { "action": { "type": "setPrizes", "player": 0, "changes": [
      { "type": "fromDeck", "player": 0, "to": { "zone": "prizes" }, "cards": [
        { "id": 8, "card": "TWM-14" }, { "id": 9, "card": "PRE-9" }, { "id": 10, "card": "ASC-184" },
        { "id": 11, "card": "MEE-1" }, { "id": 12, "card": "TWM-15" }, { "id": 13, "card": "SFA-61" } ] } ] } },
    { "action": { "type": "revealStart", "changes": [
      { "type": "reveal", "cards": { "1": "PRE-9" }, "to": "all" } ] } }
  ] }
```

Projecting this to player 0 turns the six prizes into `{ "id": 8 }` … `{ "id": 13 }`, and
the opponent side stays empty: a goldfish.

### 2. Turn 1 with a branch (solver, `"all"`)

Continuing example 1. The main line plays Poké Pad for Applin; a labeled branch from the
same node plays Lillie's Determination instead (it can't, going first: no Supporter on turn
1, so the engine's lint would flag that branch, but the fold still applies it).

```jsonc
    { "action": { "type": "startTurn", "player": 0, "changes": [
      { "type": "draw", "player": 0, "cards": [{ "id": 14, "card": "TWM-14" }] } ] } },
    // node 6: main line
    { "action": { "type": "playCard", "player": 0, "card": 2, "changes": [
      { "type": "move", "cards": [2], "to": { "zone": "pending" } },
      { "type": "fromDeck", "player": 0, "seen": "all", "to": { "zone": "hand" },
        "cards": [{ "id": 15, "card": "PRE-9" }] },
      { "type": "shuffle", "player": 0 },
      { "type": "move", "cards": [2], "to": { "zone": "discard" } } ] } },
    { "action": { "type": "playBasic", "player": 0, "card": 15, "changes": [
      { "type": "move", "cards": [15], "to": { "zone": "bench" } } ] } },
    { "action": { "type": "attachEnergy", "player": 0, "card": 3, "onto": 15, "changes": [
      { "type": "move", "cards": [3], "to": { "zone": "attached", "on": 15 } } ] } },
    { "action": { "type": "endTurn", "player": 0, "changes": [] } },
    // branch from node 5 (startTurn): first child of node 5 is node 6, this is the second
    { "parent": 5, "label": "Lillie's Determination", "action": {
      "type": "playCard", "player": 0, "card": 6, "changes": [ /* … */ ] } }
```

### 3. A real PTCG Live game (import, viewpoint = you)

From the owner's game (log pasted 2026-11-24, usernames dropped). The interesting parts:

**Setup.** Prizes are never logged, so `setPrizes` is `inferred`. The opponent's opening hand
is seven unknown instances; their face-down Active is one of them, revealed as Budew.

```jsonc
    { "action": { "type": "openingCoinFlip", "caller": 1, "call": "tails", "winner": 0, "changes": [] } },
    { "action": { "type": "chooseFirst", "player": 0, "first": 0, "changes": [] } },
    { "action": { "type": "openingHand", "player": 1, "changes": [
      { "type": "draw", "player": 1, "cards": [{ "id": 101 }, { "id": 102 }, { "id": 103 },
        { "id": 104 }, { "id": 105 }, { "id": 106 }, { "id": 107 }] } ] } },
    { "action": { "type": "openingHand", "player": 0, "changes": [
      { "type": "draw", "player": 0, "cards": [{ "id": 1, "card": "POR-81" }, { "id": 2, "card": "MEG-119" },
        { "id": 3, "card": "PRE-10" }, { "id": 4, "card": "TEF-23" }, { "id": 5, "card": "MEG-130" },
        { "id": 6, "card": "WHT-80" }, { "id": 7, "card": "PRE-10" }] } ] } },
    { "action": { "type": "placeStart", "player": 1, "changes": [
      { "type": "move", "cards": [101], "to": { "zone": "active" } } ] } },
    { "action": { "type": "placeStart", "player": 0, "changes": [
      { "type": "move", "cards": [4], "to": { "zone": "active" } } ] } },
    { "action": { "type": "setPrizes", "player": 0, "flag": "inferred", "changes": [
      { "type": "fromDeck", "player": 0, "to": { "zone": "prizes" },
        "cards": [{ "id": 8 }, { "id": 9 }, { "id": 10 }, { "id": 11 }, { "id": 12 }, { "id": 13 }] } ] } },
    { "action": { "type": "setPrizes", "player": 1, "flag": "inferred", "changes": [ /* 108–113 */ ] } },
    { "action": { "type": "revealStart", "changes": [
      { "type": "reveal", "cards": { "101": "ASC-16" }, "to": "all" } ] } }
```

**Opponent's turn 1.** Hidden draws stay unknown. Playing a card reveals one of the
unknown hand cards (they can't be told apart, so this isn't a guess). Dunsparce has two
cards in Standard and never attacked, so its print is `guessed`. Itchy Pollen's Item lock
isn't in the log at all, and it doesn't need to be: `items_locked` finds Budew's attack in
the history.

```jsonc
    { "action": { "type": "startTurn", "player": 1, "changes": [
      { "type": "draw", "player": 1, "cards": [{ "id": 114 }] } ] } },
    { "action": { "type": "playCard", "player": 1, "card": 102, "changes": [
      { "type": "reveal", "cards": { "102": "ASC-184" }, "to": "all" },
      { "type": "move", "cards": [102], "to": { "zone": "pending" } },
      { "type": "fromDeck", "player": 1, "to": { "zone": "bench" },
        "cards": [{ "id": 115, "card": "ASC-158" }, { "id": 116, "card": "ASC-158" }] },
      { "type": "shuffle", "player": 1 },
      { "type": "move", "cards": [102], "to": { "zone": "discard" } } ] } },
    { "action": { "type": "playCard", "player": 1, "card": 103, "changes": [
      { "type": "reveal", "cards": { "103": "30C-126" }, "to": "all" },
      { "type": "move", "cards": [103], "to": { "zone": "pending" } },
      { "type": "fromDeck", "player": 1, "to": { "zone": "hand" },
        "cards": [{ "id": 117, "card": "PRE-79" }], "flag": "guessed", "alternatives": ["JTG-120"] },
      { "type": "shuffle", "player": 1 },
      { "type": "move", "cards": [103], "to": { "zone": "discard" } } ] } },
    { "action": { "type": "playBasic", "player": 1, "card": 117, "changes": [
      { "type": "move", "cards": [117], "to": { "zone": "bench" } } ] } },
    { "action": { "type": "attachEnergy", "player": 1, "card": 104, "onto": 115, "changes": [
      { "type": "reveal", "cards": { "104": "MEE-2" }, "to": "all" },
      { "type": "move", "cards": [104], "to": { "zone": "attached", "on": 115 } } ] } },
    { "action": { "type": "attack", "player": 1, "pokemon": 101, "attack": 0, "changes": [   // Itchy Pollen
      { "type": "damage", "pokemon": 4, "amount": 10 } ] } },
    { "action": { "type": "endTurn", "player": 1, "flag": "inferred", "changes": [] } }
```

**Ambiguity, their turn 2.** "Evolved Dreepy to Drakloak on the Bench" with two Dreepy that
can evolve, one holding Fire Energy. The log doesn't say which, so the importer guesses, and
a later constraint can settle it: on their turn 3 the Drakloak promoted after the retreat
must hold Fire + Psychic to pay for Phantom Dive, so it was the Fire one. (Your Boss's
Orders on your turn 3 then pulls up one of two identical Dreepy: not a guess.)

```jsonc
    { "action": { "type": "evolve", "player": 1, "card": 124, "onto": 115,
      "flag": "guessed", "alternatives": [116], "changes": [
      { "type": "move", "cards": [124], "to": { "zone": "stack", "on": 115 } } ] } }
```

**Their turn 3: Phantom Dive and a Live text bug.** The log says "put 6 damage counters on
*Turkey5132's* Rellor", but Phantom Dive only places counters on the opponent's Bench, and
Rellor is yours. Facts beat text: the importer resolves the target by what the attack can
hit. Dipplin's KO discard list leaves out Dipplin itself, which is `inferred`. Prizes go to a
hand the viewer can't see, so the prize cards stay unknown.

```jsonc
    { "action": { "type": "attack", "player": 1, "pokemon": 115, "attack": 1, "changes": [   // Phantom Dive
      { "type": "damage", "pokemon": 15, "amount": 200 },
      { "type": "counters", "pokemon": 4, "count": 6 } ] } },
    { "action": { "type": "knockOut", "pokemon": 15, "changes": [
      { "type": "move", "cards": [14, 15], "to": { "zone": "discard" } },
      { "type": "move", "cards": [3], "to": { "zone": "discard" }, "flag": "inferred" } ] } },
    { "action": { "type": "knockOut", "pokemon": 4, "changes": [
      { "type": "move", "cards": [4], "to": { "zone": "discard" } } ] } },
    { "action": { "type": "takePrizes", "player": 1, "count": 2, "changes": [
      { "type": "move", "cards": [108, 109], "to": { "zone": "hand" } } ] } },
    { "action": { "type": "endGame", "winner": 1, "reason": "noPokemon", "changes": [] } }
```

### What a Live import needs (M9 notes)

- English sentences → actions; sub-entries → changes. Ability uses are sometimes worded as
  playing the card ("played Dudunsparce" = Run Away Draw).
- Second pass for rule-implied events: prizes, end of turn after an attack, cards missing
  from KO discard lists.
- Names → prints: your side from your decklist (one Applin print in the list = certain);
  the opponent's side from attack and Ability names, HP from damage taken, else `guessed`.
- Copies: pick by constraints (costs payable, targets legal), else `guessed`.
- Known card effects add changes the log leaves out, such as Recon Directive's bottom card
  (2 from deck to `pending`, one to hand, one to `deckBottom`). Effects with no change on
  the table (Itchy Pollen's Item lock) need nothing: queries find them in the history.
- Attack names → positions on the card.
- Live has text bugs (wrong owner on Phantom Dive counters): trust what the card can do.

## Implementation

- `solver/src/game/`: `record` (record, nodes, tree paths), `action` (actions, changes,
  locations), `state`, `fold` (fold, `check` over all branches), `project`. serde with
  internally tagged enums (`"type"`, `"zone"`) and camelCase; TS types generated with
  ts-rs into `web/src/game/types/` on `cargo test`.
- WASM exports `fold(record, node?)` (default: the end of the main line), `check(record)`,
  `project(record, player)`, JSON in and out; `web/src/game/solver.ts` wraps them.
- Fixtures (`solver/tests/fixtures/`): examples 1–2 as one record (`solver-opening.json`)
  and the owner's full Live game (`ptcgl-game.json`). Tests check they round-trip to the
  same JSON, fold with no consistency errors, project, and end in the logged position.
- Queries (`queries.rs`) come with the rules engine (M4), which is their first user.
