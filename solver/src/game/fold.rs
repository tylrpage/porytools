//! Applying a record: the state at a node is the fold of the actions on the path from the
//! start to it. The fold applies the changes as written, plus the rulebook bookkeeping no
//! card changes (`docs/game-format.md`, "Automatic bookkeeping"). It checks consistency
//! (every instance in exactly one place, no reused IDs, no negative counts, public cards
//! known), never legality.

use super::action::{Action, ActionKind, Change, ChangeKind, ConditionKind, DeckPos, Loc, NewCard, Zone};
use super::record::{Id, Player, Print, Record, RecordError};
use super::state::{CardInfo, Conditions, Deck, GameResult, Phase, PlayerState, Pokemon, State, Step};

/// The state at `node` (`None`: the start), or the first error on the way there.
pub fn fold(record: &Record, node: Option<usize>) -> Result<State, RecordError> {
    record.validate()?;
    if let Some(n) = node
        && n >= record.nodes.len()
    {
        return Err(RecordError::record(format!("no node {n}")));
    }
    let mut state = State::new_game(&record.start);
    if let Some(n) = node {
        for i in record.path_to(n) {
            apply_action(&mut state, i, &record.nodes[i].action)?;
        }
    }
    Ok(state)
}

/// Folds every node (all branches) and returns every error, at most one per node: a node
/// after an error isn't checked further down that branch.
pub fn check(record: &Record) -> Vec<RecordError> {
    if let Err(e) = record.validate() {
        return vec![e];
    }
    let mut errors = Vec::new();
    // states[i]: the state after node i, or None if it (or an ancestor) failed. Parents come
    // before children, so one pass in order works. Cloning a state per node is fine at
    // record sizes (hundreds of nodes); the solver will use its own representation.
    let start = State::new_game(&record.start);
    let mut states: Vec<Option<State>> = Vec::with_capacity(record.nodes.len());
    for (i, node) in record.nodes.iter().enumerate() {
        let before = match record.parent_of(i) {
            None => Some(&start),
            Some(p) => states[p].as_ref(),
        };
        let after = before
            .cloned()
            .and_then(|mut s| match apply_action(&mut s, i, &node.action) {
                Ok(()) => Some(s),
                Err(e) => {
                    errors.push(e);
                    None
                }
            });
        states.push(after);
    }
    errors
}

/// Applies one action (node `node`) to the state, then checks consistency.
///
/// `&mut State` is a *mutable* borrow: this function may change the state in place, and
/// while it holds the borrow nothing else can read or write it. That rule (one writer or
/// many readers) is how Rust prevents data races and "changed while iterating" bugs.
pub fn apply_action(state: &mut State, node: usize, action: &Action) -> Result<(), RecordError> {
    begin_action(state, node, action)?;
    let face_down = face_down_now(state);
    for (c, change) in action.changes.iter().enumerate() {
        apply_change(state, change, face_down).map_err(|message| RecordError {
            node: Some(node),
            change: Some(c),
            message,
        })?;
    }
    finish_action(state, node, action)
}

/// The bookkeeping an action does before its changes.
pub(crate) fn begin_action(state: &mut State, node: usize, action: &Action) -> Result<(), RecordError> {
    let err = |message: String| RecordError {
        node: Some(node),
        change: None,
        message,
    };
    match &action.kind {
        ActionKind::ChooseFirst { first, .. } => {
            check_player(*first).map_err(err)?;
            state.first_player = Some(*first);
        }
        ActionKind::StartTurn { .. } => {
            state.turn += 1;
            state.phase = Phase::Play;
        }
        ActionKind::Mulligan { player } => {
            check_player(*player).map_err(err)?;
            state.players[*player as usize].mulligans += 1;
        }
        ActionKind::EndGame { winner, reason } => {
            state.phase = Phase::Ended;
            state.result = Some(GameResult {
                winner: *winner,
                reason: *reason,
            });
        }
        _ => {}
    }
    Ok(())
}

/// The bookkeeping after an action's changes: flip the starting Pokémon on `revealStart`,
/// record the action in the history, check consistency.
pub(crate) fn finish_action(state: &mut State, node: usize, action: &Action) -> Result<(), RecordError> {
    if matches!(action.kind, ActionKind::RevealStart) {
        for p in &mut state.players {
            for pokemon in p.active.iter_mut().chain(p.bench.iter_mut()) {
                pokemon.face_down = false;
            }
        }
    }
    state.history.push(Step {
        node,
        turn: state.turn,
        action: action.clone(),
    });
    check_consistency(state).map_err(|message| RecordError {
        node: Some(node),
        change: None,
        message,
    })
}

/// Whether Pokémon put into play now go face down: during setup, before `revealStart`.
/// A query over the history, not a stored flag.
pub(crate) fn face_down_now(state: &State) -> bool {
    state.phase == Phase::Setup
        && !state
            .history
            .iter()
            .any(|s| matches!(s.action.kind, ActionKind::RevealStart))
}

fn check_player(p: Player) -> Result<(), String> {
    if p > 1 {
        Err(format!("no player {p}"))
    } else {
        Ok(())
    }
}

/// Where an instance is.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Place {
    Hand(Player),
    DeckTop(Player),
    DeckBottom(Player),
    Discard(Player),
    Prizes(Player),
    LostZone(Player),
    Pending(Player),
    Stadium,
    InPlay(Player, Slot, Part),
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Slot {
    Active,
    Bench(usize),
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Part {
    Stack,
    Attached,
}

fn locate(state: &State, id: Id) -> Option<Place> {
    if state.stadium.contains(&id) {
        return Some(Place::Stadium);
    }
    for (i, p) in state.players.iter().enumerate() {
        let i = i as Player;
        let lists: [(&Vec<Id>, Place); 7] = [
            (&p.hand, Place::Hand(i)),
            (&p.deck.top, Place::DeckTop(i)),
            (&p.deck.bottom, Place::DeckBottom(i)),
            (&p.discard, Place::Discard(i)),
            (&p.prizes, Place::Prizes(i)),
            (&p.lost_zone, Place::LostZone(i)),
            (&p.pending, Place::Pending(i)),
        ];
        for (list, place) in lists {
            if list.contains(&id) {
                return Some(place);
            }
        }
        let slots = p.active.iter().map(|pk| (Slot::Active, pk));
        let slots = slots.chain(p.bench.iter().enumerate().map(|(b, pk)| (Slot::Bench(b), pk)));
        for (slot, pokemon) in slots {
            if pokemon.stack.contains(&id) {
                return Some(Place::InPlay(i, slot, Part::Stack));
            }
            if pokemon.attached.contains(&id) {
                return Some(Place::InPlay(i, slot, Part::Attached));
            }
        }
    }
    None
}

fn pokemon_mut(state: &mut State, player: Player, slot: Slot) -> &mut Pokemon {
    let p = &mut state.players[player as usize];
    match slot {
        Slot::Active => p.active.as_mut().expect("located Active exists"),
        Slot::Bench(b) => &mut p.bench[b],
    }
}

/// The Pokémon whose stack holds `id`: its player and slot.
fn find_pokemon(state: &State, id: Id) -> Result<(Player, Slot), String> {
    match locate(state, id) {
        Some(Place::InPlay(p, slot, Part::Stack)) => Ok((p, slot)),
        _ => Err(format!("card {id} is not a Pokémon in play")),
    }
}

/// Takes the card out of wherever it is. A Pokémon left with no cards at all is removed.
fn take(state: &mut State, id: Id) -> Result<Place, String> {
    let place = locate(state, id).ok_or_else(|| format!("card {id} is not anywhere"))?;
    let remove = |list: &mut Vec<Id>| list.retain(|&x| x != id);
    match place {
        Place::Stadium => remove(&mut state.stadium),
        Place::InPlay(p, slot, part) => {
            let pokemon = pokemon_mut(state, p, slot);
            match part {
                Part::Stack => remove(&mut pokemon.stack),
                Part::Attached => remove(&mut pokemon.attached),
            }
            if pokemon.stack.is_empty() && pokemon.attached.is_empty() {
                remove_slot(state, p, slot);
            }
        }
        Place::Hand(p)
        | Place::DeckTop(p)
        | Place::DeckBottom(p)
        | Place::Discard(p)
        | Place::Prizes(p)
        | Place::LostZone(p)
        | Place::Pending(p) => {
            let ps = &mut state.players[p as usize];
            match place {
                Place::Hand(_) => remove(&mut ps.hand),
                Place::DeckTop(_) => remove(&mut ps.deck.top),
                Place::DeckBottom(_) => remove(&mut ps.deck.bottom),
                Place::Discard(_) => remove(&mut ps.discard),
                Place::Prizes(_) => remove(&mut ps.prizes),
                Place::LostZone(_) => remove(&mut ps.lost_zone),
                _ => remove(&mut ps.pending),
            }
        }
    }
    Ok(place)
}

fn remove_slot(state: &mut State, player: Player, slot: Slot) -> Pokemon {
    let p = &mut state.players[player as usize];
    match slot {
        Slot::Active => p.active.take().expect("located Active exists"),
        Slot::Bench(b) => p.bench.remove(b),
    }
}

fn owner(state: &State, id: Id) -> Result<Player, String> {
    state
        .cards
        .get(&id)
        .map(|c| c.owner)
        .ok_or_else(|| format!("card {id} is not a live instance"))
}

pub(crate) fn apply_change(state: &mut State, change: &Change, face_down: bool) -> Result<(), String> {
    match &change.kind {
        ChangeKind::Draw { player, cards } => {
            check_player(*player)?;
            for card in cards {
                let id = take_from_deck(state, *player, card, true)?;
                state.players[*player as usize].hand.push(id);
            }
        }
        ChangeKind::FromDeck {
            player, cards, to, ..
        } => {
            check_player(*player)?;
            for card in cards {
                let id = take_from_deck(state, *player, card, false)?;
                put(state, id, to, face_down)?;
            }
        }
        ChangeKind::Move { cards, to } => {
            for &id in cards {
                move_card(state, id, to, face_down)?;
            }
        }
        ChangeKind::ToDeck { cards, pos } => {
            let zone = match pos {
                DeckPos::Pool => Zone::Deck,
                DeckPos::Top => Zone::DeckTop,
                DeckPos::Bottom => Zone::DeckBottom,
            };
            // Listed top to bottom: put on top in reverse so the first listed ends on top.
            let order: Vec<Id> = if *pos == DeckPos::Top {
                cards.iter().rev().copied().collect()
            } else {
                cards.clone()
            };
            for id in order {
                move_card(state, id, &Loc { zone, player: None }, face_down)?;
            }
        }
        ChangeKind::Shuffle { player } => {
            check_player(*player)?;
            let deck = &mut state.players[*player as usize].deck;
            let mut known: Vec<Id> = std::mem::take(&mut deck.top);
            known.append(&mut deck.bottom);
            for id in known {
                end_into_pool(state, *player, id);
            }
        }
        ChangeKind::Reveal { cards, .. } => {
            for (&id, print) in cards {
                let info = state
                    .cards
                    .get_mut(&id)
                    .ok_or_else(|| format!("card {id} is not a live instance"))?;
                match &info.card {
                    Some(known) if known != print => {
                        return Err(format!("card {id} is {known}, revealed as {print}"));
                    }
                    _ => info.card = Some(print.clone()),
                }
            }
        }
        ChangeKind::LookAtDeck { player, contents } => {
            check_player(*player)?;
            state.players[*player as usize].deck.contents = Some(contents.clone());
        }
        ChangeKind::Switch { player, bench } => {
            check_player(*player)?;
            let (p, slot) = find_pokemon(state, *bench)?;
            let Slot::Bench(b) = slot else {
                return Err(format!("card {bench} is not on the Bench"));
            };
            if p != *player {
                return Err(format!("card {bench} is not player {player}'s"));
            }
            let ps = &mut state.players[p as usize];
            let mut new_active = ps.bench.remove(b);
            if let Some(mut old) = ps.active.take() {
                old.conditions = Conditions::default();
                ps.bench.insert(b, old);
            }
            new_active.face_down = false;
            ps.active = Some(new_active);
        }
        ChangeKind::Damage { pokemon, amount } => {
            if amount % 10 != 0 {
                return Err(format!("damage {amount} is not a multiple of 10"));
            }
            let (p, slot) = find_pokemon(state, *pokemon)?;
            pokemon_mut(state, p, slot).counters += amount / 10;
        }
        ChangeKind::Counters { pokemon, count } => {
            let (p, slot) = find_pokemon(state, *pokemon)?;
            pokemon_mut(state, p, slot).counters += count;
        }
        ChangeKind::Heal { pokemon, amount } => {
            let (p, slot) = find_pokemon(state, *pokemon)?;
            let pk = pokemon_mut(state, p, slot);
            // Healing more than the damage heals it all.
            pk.counters = pk.counters.saturating_sub(amount / 10);
        }
        ChangeKind::Condition { pokemon, add, remove } => {
            let (p, slot) = find_pokemon(state, *pokemon)?;
            let c = &mut pokemon_mut(state, p, slot).conditions;
            if let Some(k) = remove {
                match k {
                    ConditionKind::Poisoned => c.poisoned = false,
                    ConditionKind::Burned => c.burned = false,
                    rot if c.rotation == Some(*rot) => c.rotation = None,
                    _ => {}
                }
            }
            if let Some(k) = add {
                match k {
                    ConditionKind::Poisoned => c.poisoned = true,
                    ConditionKind::Burned => c.burned = true,
                    rot => c.rotation = Some(*rot),
                }
            }
        }
        ChangeKind::CoinFlip { .. } | ChangeKind::Choose { .. } => {}
    }
    Ok(())
}

/// Takes one card from a player's deck: the known top card if there is one and `top_first`
/// (draws), else a new instance from the pool.
fn take_from_deck(state: &mut State, player: Player, card: &NewCard, top_first: bool) -> Result<Id, String> {
    let deck = &mut state.players[player as usize].deck;
    if top_first && let Some(&top) = deck.top.first() {
        if card.id != top {
            return Err(format!("drew {}, but the known top card is {top}", card.id));
        }
        deck.top.remove(0);
        if let Some(print) = &card.card {
            let info = state.cards.get_mut(&top).expect("deck cards are live");
            match &info.card {
                Some(known) if known != print => {
                    return Err(format!("card {top} is {known}, drawn as {print}"));
                }
                _ => info.card = Some(print.clone()),
            }
        }
        return Ok(top);
    }
    if state.cards.contains_key(&card.id) {
        return Err(format!("card ID {} is already in use", card.id));
    }
    let deck = &mut state.players[player as usize].deck;
    if deck.count == 0 {
        return Err(format!("player {player}'s deck pool is empty"));
    }
    deck.count -= 1;
    take_from_contents(deck, card.card.as_ref())?;
    state.cards.insert(
        card.id,
        CardInfo {
            owner: player,
            card: card.card.clone(),
        },
    );
    Ok(card.id)
}

/// Updates known deck contents for a card leaving the pool.
fn take_from_contents(deck: &mut Deck, print: Option<&Print>) -> Result<(), String> {
    let Some(contents) = &mut deck.contents else {
        return Ok(());
    };
    let Some(print) = print else {
        // The viewer doesn't know what left, so they no longer know what's in the pool.
        deck.contents = None;
        return Ok(());
    };
    let entry = contents
        .iter_mut()
        .find(|(p, n)| p == print && *n > 0)
        .ok_or_else(|| format!("no {print} left in the deck"))?;
    entry.1 -= 1;
    contents.retain(|(_, n)| *n > 0);
    Ok(())
}

/// A tracked instance rejoins the deck pool: the instance ends.
fn end_into_pool(state: &mut State, player: Player, id: Id) {
    let info = state.cards.remove(&id).expect("deck cards are live");
    let deck = &mut state.players[player as usize].deck;
    deck.count += 1;
    match (&mut deck.contents, info.card) {
        (Some(contents), Some(print)) => match contents.iter_mut().find(|(p, _)| *p == print) {
            Some(entry) => entry.1 += 1,
            None => contents.push((print, 1)),
        },
        (Some(_), None) => deck.contents = None,
        (None, _) => {}
    }
}

/// Moves an existing instance. A card of a Pokémon's stack moved to the Active Spot or the
/// Bench moves the whole Pokémon (promote, Switch effects).
fn move_card(state: &mut State, id: Id, to: &Loc, face_down: bool) -> Result<(), String> {
    let owner = owner(state, id)?;
    let dest_player = to.player.unwrap_or(owner);
    check_player(dest_player)?;
    if matches!(to.zone, Zone::Active | Zone::Bench)
        && let Some(Place::InPlay(p, slot, Part::Stack)) = locate(state, id)
    {
        if p != dest_player {
            return Err(format!("card {id} can't move to the other player's side"));
        }
        let mut pokemon = remove_slot(state, p, slot);
        let ps = &mut state.players[p as usize];
        if to.zone == Zone::Active {
            if ps.active.is_some() {
                return Err("the Active Spot is taken".to_string());
            }
            ps.active = Some(pokemon);
        } else {
            pokemon.conditions = Conditions::default();
            ps.bench.push(pokemon);
        }
        return Ok(());
    }
    take(state, id)?;
    put(state, id, to, face_down)
}

/// Puts a card that's in no zone (just taken) somewhere.
fn put(state: &mut State, id: Id, to: &Loc, face_down: bool) -> Result<(), String> {
    let owner = owner(state, id)?;
    let player = to.player.unwrap_or(owner);
    check_player(player)?;
    let new_pokemon = Pokemon {
        stack: vec![id],
        face_down,
        ..Pokemon::default()
    };
    match to.zone {
        Zone::Deck => end_into_pool(state, player, id),
        Zone::DeckTop => state.players[player as usize].deck.top.insert(0, id),
        Zone::DeckBottom => state.players[player as usize].deck.bottom.push(id),
        Zone::Active => {
            let ps = &mut state.players[player as usize];
            if ps.active.is_some() {
                return Err("the Active Spot is taken".to_string());
            }
            ps.active = Some(new_pokemon);
        }
        Zone::Bench => state.players[player as usize].bench.push(new_pokemon),
        Zone::Stadium => state.stadium.push(id),
        Zone::Stack { on } | Zone::Attached { on } => {
            let (p, slot) = find_pokemon(state, on)?;
            let pokemon = pokemon_mut(state, p, slot);
            if let Zone::Stack { .. } = to.zone {
                pokemon.stack.push(id);
                pokemon.conditions = Conditions::default();
            } else {
                pokemon.attached.push(id);
            }
        }
        zone => {
            let ps: &mut PlayerState = &mut state.players[player as usize];
            let list = match zone {
                Zone::Hand => &mut ps.hand,
                Zone::Discard => &mut ps.discard,
                Zone::Prizes => &mut ps.prizes,
                Zone::LostZone => &mut ps.lost_zone,
                _ => &mut ps.pending,
            };
            list.push(id);
        }
    }
    Ok(())
}

/// Every instance in exactly one place, public cards known, counts sane.
fn check_consistency(state: &State) -> Result<(), String> {
    let mut seen = std::collections::BTreeSet::new();
    let mut visit = |id: Id, public: bool| -> Result<(), String> {
        if !seen.insert(id) {
            return Err(format!("card {id} is in two places"));
        }
        let info = state
            .cards
            .get(&id)
            .ok_or_else(|| format!("card {id} is not a live instance"))?;
        if public && info.card.is_none() {
            return Err(format!("card {id} is face up but unknown"));
        }
        Ok(())
    };
    for &id in &state.stadium {
        visit(id, true)?;
    }
    if state.stadium.len() > 2 {
        return Err("more than 2 Stadium cards in play".to_string());
    }
    for p in &state.players {
        for list in [&p.hand, &p.deck.top, &p.deck.bottom, &p.prizes, &p.pending] {
            for &id in list {
                visit(id, false)?;
            }
        }
        for list in [&p.discard, &p.lost_zone] {
            for &id in list {
                visit(id, true)?;
            }
        }
        for pokemon in p.active.iter().chain(p.bench.iter()) {
            if pokemon.stack.is_empty() {
                return Err(format!(
                    "a Pokémon has only attached cards ({:?})",
                    pokemon.attached
                ));
            }
            for &id in pokemon.stack.iter().chain(pokemon.attached.iter()) {
                visit(id, !pokemon.face_down)?;
            }
        }
        if let Some(contents) = &p.deck.contents {
            let total: u32 = contents.iter().map(|(_, n)| n).sum();
            if total != p.deck.count {
                return Err(format!(
                    "deck contents list {total} cards, the pool has {}",
                    p.deck.count
                ));
            }
        }
    }
    if seen.len() != state.cards.len() {
        let lost: Vec<Id> = state
            .cards
            .keys()
            .filter(|id| !seen.contains(id))
            .copied()
            .collect();
        return Err(format!("cards {lost:?} are nowhere"));
    }
    Ok(())
}
