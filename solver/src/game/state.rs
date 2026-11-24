//! The state: what's physically on the table, plus the history (`docs/game-format.md`,
//! "State"). Everything else is a query over the two (`queries.rs`).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::action::{Action, ConditionKind};
use super::record::{Contents, Id, Player, Print, Start};

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    #[default]
    Setup,
    Play,
    Ended,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct State {
    pub phase: Phase,
    pub first_player: Option<Player>,
    /// Global: 0 setup, 1 = first player's turn 1, 2 = second player's turn 1, …
    pub turn: u32,
    /// Every live instance.
    pub cards: BTreeMap<Id, CardInfo>,
    pub players: [PlayerState; 2],
    /// 0, 1, or 2 (a Legendary Stadium) cards.
    pub stadium: Vec<Id>,
    pub result: Option<GameResult>,
    /// The actions so far: the path from the start to this state.
    pub history: Vec<Step>,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CardInfo {
    pub owner: Player,
    /// `None` while the viewer doesn't know which card it is.
    pub card: Option<Print>,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameResult {
    pub winner: Option<Player>,
    pub reason: super::action::EndReason,
}

/// One entry of the history: the node it came from, the turn it happened in, the action.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    pub node: usize,
    pub turn: u32,
    pub action: Action,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    pub deck: Deck,
    pub hand: Vec<Id>,
    pub active: Option<Pokemon>,
    /// Order is display only.
    pub bench: Vec<Pokemon>,
    /// Oldest first.
    pub discard: Vec<Id>,
    pub prizes: Vec<Id>,
    pub lost_zone: Vec<Id>,
    pub pending: Vec<Id>,
    pub mulligans: u32,
}

/// A deck: known cards on top and bottom (tracked instances), and between them a pool of
/// untracked cards in unknown order.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Deck {
    /// Top first.
    pub top: Vec<Id>,
    /// Cards in the pool (not counting `top` and `bottom`).
    pub count: u32,
    /// The pool's exact contents when the viewer knows them, else `None`.
    pub contents: Option<Contents>,
    /// Bottom last.
    pub bottom: Vec<Id>,
}

impl Deck {
    pub fn size(&self) -> u32 {
        self.count + self.top.len() as u32 + self.bottom.len() as u32
    }
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Pokemon {
    /// Bottom → top; the top card is the Pokémon.
    pub stack: Vec<Id>,
    pub attached: Vec<Id>,
    /// Damage counters (damage = 10 × counters).
    pub counters: u32,
    pub conditions: Conditions,
    /// During setup, before the reveal.
    pub face_down: bool,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Conditions {
    /// Asleep, Confused and Paralyzed replace each other.
    pub rotation: Option<ConditionKind>,
    pub poisoned: bool,
    pub burned: bool,
}

impl State {
    /// The state at the start of a new game: just the decks.
    ///
    /// `&Start` is a *borrow*: this function reads `start` without taking ownership, so the
    /// caller keeps it. Every value in Rust has one owner; passing `start` without `&` would
    /// move it in and the caller couldn't use it afterwards.
    pub fn new_game(start: &Start) -> State {
        let player = |i: usize| {
            let deck = &start.players[i].deck;
            PlayerState {
                deck: Deck {
                    count: deck.count,
                    contents: deck.contents.clone(),
                    ..Deck::default()
                },
                ..PlayerState::default()
            }
        };
        State {
            phase: Phase::Setup,
            first_player: None,
            turn: 0,
            cards: BTreeMap::new(),
            players: [player(0), player(1)],
            stadium: Vec::new(),
            result: None,
            history: Vec::new(),
        }
    }

    /// The player whose turn it is (`None` during setup).
    pub fn turn_player(&self) -> Option<Player> {
        let first = self.first_player?;
        if self.turn == 0 {
            return None;
        }
        Some(if self.turn % 2 == 1 { first } else { 1 - first })
    }

    /// The player's own count for a global turn ("Your turn 2"), if it's their turn.
    pub fn own_turn_number(&self, player: Player, turn: u32) -> Option<u32> {
        let first = self.first_player?;
        let offset = if player == first { 1 } else { 0 };
        if turn == 0 || (turn % 2 == 1) != (offset == 1) {
            return None;
        }
        Some(turn.div_ceil(2))
    }

    pub fn print_of(&self, id: Id) -> Option<&str> {
        self.cards.get(&id)?.card.as_deref()
    }
}
