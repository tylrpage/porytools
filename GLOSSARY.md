# porytools

The shared language for porytools, the Pokémon TCG deck-analysis tools. Code, specs, UI text
and conversations use these words. Game terms follow the official rules and PTCG Live wording;
this file covers the words porytools adds on top.

## Game records

**Game record**:
A whole game (or a solver's tree of games) from the two decks onward, as a start plus a tree
of actions. The format is in `docs/game-format.md`.
_Avoid_: replay file, log, save

**Action**:
One main entry in a record: something a player did, or a rule step, with the changes it made.
_Avoid_: event, move, step

**Change**:
One alteration to the state inside an action, such as a card moving between zones or a
reveal. Changes are the only thing that alters the state.
_Avoid_: sub-event, effect

**Node**:
One action's place in a record's tree. The state at a node is everything from the start up to
and including it.

**Main line**:
The path through a record that follows each node's first child.

**Branch**:
A path that leaves the main line at a node: a different decision, or a different draw.
_Avoid_: variation, fork

**Viewpoint**:
Whose knowledge a record holds: one player's, or `all` (everything, as solver output has).
_Avoid_: perspective, POV

**Projection**:
A record reduced to one player's viewpoint: whatever that player didn't see becomes unknown.

**Instance**:
A single card that can still be told apart from its copies, because it's known where it went.
A shuffle into the deck ends it.

**Guessed**:
A flag on a change whose source didn't say which copy or print it was, so one was picked and
the others listed.

**Inferred**:
A flag on an action or change the source never stated, but the rules or a known card effect
imply.

**Query**:
A fact worked out from the table and its history rather than stored, such as "played a
Supporter this turn".
_Avoid_: flag, status (for these)

**Turn number**:
The game's single count of turns: 1 is the first player's first turn, 2 the second player's
first, and 0 is setup. Never shown to users.

**Your turn N**:
How the UI counts turns: the player's own count, as players say it.
_Avoid_: showing the turn number

## Solver

**Goal**:
What the user wants the deck to reach, written in the goal language (Pokémon in play, attack
payable, combined with and/or) with a turn bound and going first or second.
_Avoid_: target, condition, win condition

**Line**:
One sequence of play that reaches (or tries to reach) a goal, shown as a game record.
_Avoid_: path, combo, sequence

**Goldfish**:
Playing a deck with no opponent interaction, to see how it sets up. The opponent is an empty
placeholder.
_Avoid_: solo play, sandbox

**Clairvoyant**:
Allowed to see hidden information (deck order, prizes). The upper bound on odds; a real player
can't do it.

## Cards

**Print**:
One printing of a card, named by set code and number as PTCG Live lists it (`TEF-23`).
Reprints with identical game text collapse to one card.
_Avoid_: card ID (in UI text), version

**Card status**:
How far porytools models a card's effect: `verified` (owner reviewed), `draft`, or
`unsupported` (treated as blank).
