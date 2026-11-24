//! Actions and the changes inside them (`docs/game-format.md`, "Actions and changes").
//!
//! An action is one main entry (something a player did, or a rule step). Its `changes` are
//! the only thing that alters the state.
//!
//! JSON shape: `{ "type": "playCard", "player": 0, "card": 1, "changes": [...] }`. In Rust
//! that's a struct with the common fields (`changes`, `flag`) plus an enum for the
//! type-specific part. `#[serde(tag = "type")]` stores the enum variant as the `"type"`
//! key, and `#[serde(flatten)]` merges the enum's fields into the struct's JSON object.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::record::{Contents, Id, Player, Print, Viewer};

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    #[serde(flatten)]
    #[ts(flatten)]
    pub kind: ActionKind,
    #[serde(default)]
    pub changes: Vec<Change>,
    #[serde(flatten)]
    #[ts(flatten)]
    pub note: Note,
}

/// `flag` and `alternatives`, which any action or change may carry.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub flag: Option<Flag>,
    /// With `guessed`: the other candidates (instance IDs or prints).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub alternatives: Option<Vec<Alternative>>,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Flag {
    /// Not in the source; implied by the rules or a known card effect.
    Inferred,
    /// The source was ambiguous; see `alternatives`.
    Guessed,
}

/// An instance ID or a print. `untagged`: JSON is just the number or the string.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Eq)]
#[serde(untagged)]
pub enum Alternative {
    Instance(Id),
    Print(Print),
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Coin {
    Heads,
    Tails,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EndReason {
    Prizes,
    NoPokemon,
    DeckOut,
    Concede,
    Other,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ActionKind {
    OpeningCoinFlip {
        caller: Player,
        call: Coin,
        winner: Player,
    },
    /// Sets who goes first.
    ChooseFirst {
        player: Player,
        first: Player,
    },
    /// Draw 7.
    OpeningHand {
        player: Player,
    },
    /// Reveal, shuffle back, draw 7.
    Mulligan {
        player: Player,
    },
    /// Face-down Active and Bench.
    PlaceStart {
        player: Player,
    },
    /// 6 face-down prizes.
    SetPrizes {
        player: Player,
    },
    /// Extra draws for the opponent's extra mulligans.
    MulliganDraws {
        player: Player,
        count: u32,
    },
    /// Flip the starting Pokémon face up.
    RevealStart,
    /// Includes the draw for turn.
    StartTurn {
        player: Player,
    },
    /// Item, Supporter, Stadium, or Tool.
    PlayCard {
        player: Player,
        card: Id,
    },
    /// To the Bench from hand.
    PlayBasic {
        player: Player,
        card: Id,
    },
    Evolve {
        player: Player,
        card: Id,
        onto: Id,
    },
    /// The once-per-turn attachment from hand.
    AttachEnergy {
        player: Player,
        card: Id,
        onto: Id,
    },
    Retreat {
        player: Player,
        pokemon: Id,
        to: Id,
    },
    UseAbility {
        player: Player,
        pokemon: Id,
    },
    /// Effects that fire by themselves (on play, on KO…).
    Trigger {
        player: Player,
        card: Id,
    },
    Attack {
        player: Player,
        pokemon: Id,
        /// Position in the top card's attacks (or `from`'s).
        attack: u8,
        /// The Tool that grants the attack.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        from: Option<Id>,
    },
    /// Pokémon Checkup between turns.
    Checkup,
    KnockOut {
        pokemon: Id,
    },
    TakePrizes {
        player: Player,
        count: u32,
    },
    /// New Active after a KO.
    Promote {
        player: Player,
        pokemon: Id,
    },
    EndTurn {
        player: Player,
    },
    EndGame {
        /// `null` for a tie.
        winner: Option<Player>,
        reason: EndReason,
    },
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    #[serde(flatten)]
    #[ts(flatten)]
    pub kind: ChangeKind,
    #[serde(flatten)]
    #[ts(flatten)]
    pub note: Note,
}

/// A card instance being created: `{ "id": 14, "card": "MEE-1" }`, or `{ "id": 14 }` when
/// its identity is unknown to the viewer.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NewCard {
    pub id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub card: Option<Print>,
}

/// Who saw cards taken from the deck (only in `"all"` records).
#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Seen {
    Owner,
    All,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeckPos {
    /// The unordered part. Cards put here stop being tracked instances.
    Pool,
    Top,
    Bottom,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ConditionKind {
    Asleep,
    Confused,
    Paralyzed,
    Poisoned,
    Burned,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ChangeKind {
    /// From the top of the deck (known top cards first) to hand.
    Draw {
        player: Player,
        cards: Vec<NewCard>,
    },
    /// Search or look: takes cards from the pool.
    FromDeck {
        player: Player,
        cards: Vec<NewCard>,
        to: Loc,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        seen: Option<Seen>,
    },
    /// Moves exactly those instances.
    Move {
        cards: Vec<Id>,
        to: Loc,
    },
    ToDeck {
        cards: Vec<Id>,
        pos: DeckPos,
    },
    /// Known top and bottom cards rejoin the pool.
    Shuffle {
        player: Player,
    },
    /// Makes identities known. JSON object keys are strings (`{ "1": "PRE-9" }`); serde
    /// reads them as numbers. `BTreeMap` is a map kept sorted by key.
    Reveal {
        #[serde(deserialize_with = "id_keys")]
        #[ts(type = "Record<number, string>")]
        cards: BTreeMap<Id, Print>,
        to: Viewer,
    },
    /// The viewer sees the whole deck pool (e.g. during a search).
    LookAtDeck {
        player: Player,
        contents: Contents,
    },
    /// Swaps the Active with that Benched Pokémon.
    Switch {
        player: Player,
        bench: Id,
    },
    /// After Weakness and Resistance; stored as counters.
    Damage {
        pokemon: Id,
        amount: u32,
    },
    /// Damage counters placed directly.
    Counters {
        pokemon: Id,
        count: u32,
    },
    Heal {
        pokemon: Id,
        amount: u32,
    },
    Condition {
        pokemon: Id,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        add: Option<ConditionKind>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        remove: Option<ConditionKind>,
    },
    CoinFlip {
        result: Coin,
    },
    /// A choice that changes nothing on the table but that later queries need.
    Choose {
        what: String,
        value: String,
    },
}

/// Reads `{ "1": "PRE-9" }` into a map with number keys. serde can usually do this itself, but
/// not inside a `flatten`ed enum (it buffers the keys as strings first), which `Change` is.
fn id_keys<'de, D: serde::Deserializer<'de>>(d: D) -> Result<BTreeMap<Id, Print>, D::Error> {
    let raw = BTreeMap::<String, Print>::deserialize(d)?;
    raw.into_iter()
        .map(|(k, v)| {
            k.parse::<Id>()
                .map(|id| (id, v))
                .map_err(|_| serde::de::Error::custom(format!("bad instance ID {k:?}")))
        })
        .collect()
}

/// A location. `player` defaults to the card's owner.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Loc {
    #[serde(flatten)]
    #[ts(flatten)]
    pub zone: Zone,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub player: Option<Player>,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(tag = "zone", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Zone {
    Hand,
    /// The pool.
    Deck,
    DeckTop,
    DeckBottom,
    Active,
    Bench,
    Discard,
    Prizes,
    LostZone,
    Stadium,
    /// Being played or looked at.
    Pending,
    /// On top of that Pokémon's stack (evolving).
    Stack {
        on: Id,
    },
    /// Energy, Tools.
    Attached {
        on: Id,
    },
}

impl Zone {
    /// Zones whose cards everyone can see (face-down setup Pokémon aside).
    pub fn is_public(self) -> bool {
        matches!(
            self,
            Zone::Active
                | Zone::Bench
                | Zone::Discard
                | Zone::LostZone
                | Zone::Stadium
                | Zone::Stack { .. }
                | Zone::Attached { .. }
        )
    }
}
