# Game record format (v1, draft)

One format for solver output, replays, imported games, and mid-game analysis. Decided with
the owner in the M3 design session (2026-11-24); this file is the spec. Rust types (serde)
are the source of truth once they exist, and TS types are generated from them.

## Decisions

| Topic | Decision |
|---|---|
| Truth | A record **spells out every change** (what moved where, what was revealed). Applying it needs card *data* (names, kinds, stages) but never card *effects*, so unmodeled cards, manual recordings and Live imports all load. Legality is checked separately by the engine (M4+), never by the fold. |
| Viewpoint | Each record has a `viewpoint`: player `0`, player `1`, or `"all"`. Events hold only what that viewer learned. An `"all"` record (solver, sims) can be **projected** to one player's view. |
| Branching | A record is a **tree** of nodes. The state at a node is the fold of the path from the start to it. Linear records need no extra syntax. |
| Card identity | Cards are **instances** only while they can be tracked. The unordered part of a deck is a pool of counts, and a shuffle ends instances (no one can know it's "the same Pidgey" afterwards). |
| Copies | When a source doesn't say which copy (or which print), pick one and flag it `guessed`, listing the alternatives. Copies that can't be told apart (same card, same state) are not guesses. Events the source never states, but the rules or a known card effect imply, are flagged `inferred`. |
| Players | Always two. A goldfish opponent is an empty placeholder. No usernames: the UI says "You" / "Opponent" from the viewpoint (or "Player 1/2" for `"all"`). |
| Turns | **"Turn N" means that player's Nth turn**, as players say it and as the odds page uses it: `{ "player": 0, "turn": 2 }` is player 0's second turn. Global order comes from the event order. |
| Start | A record starts from any **snapshot** (a `State`). A new game is just two decks; setup (coin flip, hands, mulligans, prizes) is logged as events. The M8 board editor produces mid-game snapshots. |
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
  "start": { /* State; see below. A new game needs only the decks. */ },
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
| `mulliganDraws` | `player`, `count` | Extra cards for the opponent's mulligans. |
| `revealStart` | | Flip the starting Pokémon face up. |
| `startTurn` | `player` | Includes the draw for turn (or the deck-out loss). |
| `playCard` | `player`, `card` | Item, Supporter, Stadium, or Tool. |
| `playBasic` | `player`, `card` | To the Bench from hand. |
| `evolve` | `player`, `card`, `onto` | |
| `attachEnergy` | `player`, `card`, `onto` | The once-per-turn attachment from hand. Attachments by effects are changes inside other actions. |
| `retreat` | `player`, `pokemon`, `to` | |
| `useAbility` | `player`, `pokemon`, `ability` (name) | |
| `trigger` | `player`, `card`, `ability`? | Effects that fire by themselves (on play, on KO…). |
| `attack` | `player`, `pokemon`, `attack` (name) | |
| `checkup` | | Pokémon Checkup between turns. |
| `knockOut` | `pokemon`, `cause` | `cause`: `attack` (damage from an attack), `counters` (damage counters from an attack or effect), `checkup`, `other`. |
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
| `addMarker` / `removeMarker` | `marker` / `key` + `on` | See Markers. |

`seen` on `fromDeck` (only in `"all"` records): who saw the cards, `owner` (default) or
`all` (the card says "reveal it"). Projection uses it. In a player-view record it is
omitted: if a change names a card, the viewer saw it.

### Locations

```jsonc
{ "zone": "hand", "player": 0 }
{ "zone": "deck" }          // the pool; also "deckTop", "deckBottom"
{ "zone": "active" }  { "zone": "bench" }  { "zone": "discard" }  { "zone": "prizes" }
{ "zone": "lostZone" }  { "zone": "stadium" }
{ "zone": "pending" }       // being played or looked at, like Live's *Pending positions
{ "zone": "stack", "on": 15 }      // evolve: goes on top of that Pokémon
{ "zone": "attached", "on": 15 }   // Energy, Tools
```

`player` defaults to the card's owner. A Pokémon in play is referenced by **any card in its
stack** (canonically the bottom card, which survives evolution).

## State

The fold's output and the snapshot format. Fields left out take their defaults (empty,
zero, `null`), so a new game's start is short:

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
  turn           { player, turn } | null       current turn
  cards          id → { owner, card: print | null }   every live instance
  players[2]     PlayerState
  stadium        id | null                     owner = the card's owner
  markers        Marker[]
  thisTurn       TurnFacts
  prevTurns      TurnFacts[≤2]                 opponent's last turn, then your last turn
  result         { winner, reason } | null

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
  enteredPlay    { player, turn } | "setup"
  evolvedOn      { player, turn } | null
  faceDown       bool                          during setup

TurnFacts  (one per turn)
  turn           { player, turn }
  played         id[]                          cards played from hand
  supporter      id | null
  stadium        id | null                     Stadium played this turn
  energyAttached n                             attachEnergy actions
  retreated      bool
  abilities      [pokemon id, ability name][]
  attacks        [pokemon id, attack name][]
  knockOuts      [owner, card print, cause][]
```

`deck.contents` is the pool's exact contents when the viewer knows them (their own deck in a
new game, or after `lookAtDeck`), else `null`. What a player's unknown cards *could* be (deck
pool, prizes, the opponent's hand) is derived: decklist minus every known instance.

### Automatic bookkeeping

The fold applies these rule facts itself, because no card changes them:
- A Basic moved into the Active Spot or Bench from outside play becomes a new Pokémon with
  `enteredPlay` = the current turn.
- A card moved onto a `stack` sets `evolvedOn` and clears Special Conditions.
- A Pokémon leaving the Active Spot clears Special Conditions and markers with `leavesActive`.
- When a Pokémon's last stack card leaves play, the Pokémon and its markers are removed and
  its counters are cleared.
- `startTurn` pushes `thisTurn` into `prevTurns`. `endTurn` removes expired markers.
- Actions fill `TurnFacts`: `playCard` of a Supporter or Stadium, `attachEnergy`, `retreat`,
  `useAbility`, `attack`, `knockOut`.

The fold checks only **consistency**: every instance is in exactly one place, IDs are unused
when created, counts never go negative, and cards in public zones have known identities
(face-down setup Pokémon and prizes excepted). It does not check legality.

### Markers

Effects with a duration, or one-off facts a card can ask about later:

```jsonc
{ "key": "budew.itchyPollen", "on": { "player": 0 }, "source": 101,
  "until": [{ "turnEnds": { "player": 0, "turn": 2 } }] }
```

- `on`: `{ "player": n }`, `{ "pokemon": id }`, or `"game"`.
- `until` (any of): `{ "turnEnds": turn }`, `"leavesActive"`, `"leavesPlay"`, `"evolves"`.
  Empty means it stays until a `removeMarker`. Effects that "last during your opponent's next
  turn" get a concrete turn when they're added.
- Keys are `<card>.<effect>` strings, listed in the registry below.

## Projection (`"all"` → one player)

`project(record, player)` returns that player's view: identities they didn't see become
unknown (opponent's draws, prizes, `fromDeck` without `seen: all`), `lookAtDeck` by the
opponent is dropped, and `deck.contents` follows the same rule. Each change type has a
default for who sees it: `draw` → owner, `fromDeck` → `seen`, `reveal` → `to`, moves into
public zones → everyone.

## State registry

**Every fact the state records, and why.** When a new card needs something that isn't here,
that's a code change: add a row, then extend the Rust types and the fold. The card-effect
authoring skill (M4) points here.

| Fact | Where | Needed by |
|---|---|---|
| Deck pool count, known top/bottom, known contents | `PlayerState.deck` | Draws, searches, Recon Directive (bottom), deck-out |
| Hand, discard, Lost Zone, prizes | `PlayerState` | Every zone rule; Lost Zone for older cards (cheap) |
| Pending zone | `PlayerState.pending` | Cards being played or looked at (Recon Directive's 2) |
| Mulligan count | `PlayerState.mulligans` | Opponent's extra draws |
| Evolution stack, attachments | `Pokemon` | Evolution, KO discards, Energy costs, Tools |
| Damage counters | `Pokemon.counters` | KOs, damage goals (M8) |
| Special Conditions | `Pokemon.conditions` | Checkup; Asleep/Confused/Paralyzed replace each other, Poisoned/Burned stack |
| Turn it came into play / evolved | `Pokemon.enteredPlay`, `evolvedOn` | No evolving on the turn it came into play or already evolved |
| Face-down during setup | `Pokemon.faceDown` | Setup |
| Who goes first, current turn | `State` | Going-first: no Supporter, no attack on turn 1 |
| Supporter / Stadium / Energy / retreat this turn | `TurnFacts` | Once-per-turn rules |
| Abilities used this turn (per Pokémon, by name) | `TurnFacts.abilities` | "Once during your turn"; "can't use more than 1 Flip the Script Ability each turn" (Fezandipiti ex) |
| Attacks used | `TurnFacts.attacks` | "If this Pokémon used X during your last turn" |
| Cards played from hand | `TurnFacts.played` | "If you played X this turn" |
| KOs and how they happened, last 2 turns | `TurnFacts.knockOuts` | Fezandipiti ex Flip the Script (KO during opponent's last turn); cards that care about KO by damage |
| Stadium in play and its owner | `State.stadium` | Replacing it discards to the owner's discard |
| Result | `State.result` | Win by prizes / no Pokémon / deck-out; ties (Sudden Death) |
| Marker `budew.itchyPollen` | `State.markers`, on a player | Budew Itchy Pollen: no Items during that player's next turn |

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
isn't in the log at all; knowing Budew's attack, the importer adds it as `inferred`.

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
    { "action": { "type": "attack", "player": 1, "pokemon": 101, "attack": "Itchy Pollen", "changes": [
      { "type": "damage", "pokemon": 4, "amount": 10 },
      { "type": "addMarker", "flag": "inferred", "marker": { "key": "budew.itchyPollen",
        "on": { "player": 0 }, "source": 101, "until": [{ "turnEnds": { "player": 0, "turn": 2 } }] } } ] } },
    { "action": { "type": "endTurn", "player": 1, "flag": "inferred", "changes": [] } }
```

**Ambiguity, your turn 3.** "Boss's Orders: Dreepy was switched with Budew" with two Dreepy
benched, one holding Fire Energy. The log doesn't say which, so the importer guesses, and
a later constraint can settle it: on their turn 3 the Drakloak promoted after the retreat
must hold Fire + Psychic to pay for Phantom Dive.

```jsonc
      { "type": "switch", "player": 1, "bench": 116, "flag": "guessed", "alternatives": [115] }
```

**Their turn 3: Phantom Dive and a Live text bug.** The log says "put 6 damage counters on
*Turkey5132's* Rellor", but Phantom Dive only places counters on the opponent's Bench, and
Rellor is yours. Facts beat text: the importer resolves the target by what the attack can
hit. Dipplin's KO discard list leaves out Dipplin itself, which is `inferred`. Prizes go to a
hand the viewer can't see, so the prize cards stay unknown.

```jsonc
    { "action": { "type": "attack", "player": 1, "pokemon": 115, "attack": "Phantom Dive", "changes": [
      { "type": "damage", "pokemon": 15, "amount": 200 },
      { "type": "counters", "pokemon": 4, "count": 6 } ] } },
    { "action": { "type": "knockOut", "pokemon": 15, "cause": "attack", "changes": [
      { "type": "move", "cards": [14, 15], "to": { "zone": "discard" } },
      { "type": "move", "cards": [3], "to": { "zone": "discard" }, "flag": "inferred" } ] } },
    { "action": { "type": "knockOut", "pokemon": 4, "cause": "counters", "changes": [
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
- Known card effects add what the log leaves out: `budew.itchyPollen`, Recon Directive's
  bottom card (from deck to `pending`, one to hand, one to `deckBottom`).
- Live has text bugs (wrong owner on Phantom Dive counters): trust what the card can do.

## Open for implementation

- Rust layout: a `solver/` crate with `game::{record, state, change, fold, project}`; serde
  with internally tagged enums (`"type"`) and camelCase; TS types generated with `ts-rs`;
  WASM exports `fold(record, node)`, `check(record)`, `project(record, player)`.
- Round-trip tests: every example here parses, folds without consistency errors, and
  re-serializes to the same JSON. The full Live game is a fixture.
