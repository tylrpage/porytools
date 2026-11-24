//! A game record: two decks, then a tree of nodes, each holding one action
//! (`docs/game-format.md`, "Record" and "Nodes").
//!
//! Rust notes for this file:
//! - `#[derive(...)]` asks the compiler to write standard code for a type. `Serialize` /
//!   `Deserialize` (from the serde crate) generate the JSON conversion, `TS` (ts-rs) the
//!   TypeScript type, `Clone` a deep copy, `PartialEq` `==`, `Debug` printing for tests.
//! - `#[serde(...)]` attributes shape the JSON: `rename_all = "camelCase"` turns
//!   `first_player` into `firstPlayer`, `skip_serializing_if` leaves a field out when empty.
//! - `Option<T>` is a value that may be missing: `Some(x)` or `None`. Rust has no null, so
//!   anything optional is spelled out in the type.

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::TS;

use super::action::Action;

/// A player: `0` or `1`. (A type alias: just another name for `u8`, an unsigned byte.)
pub type Player = u8;

/// A card instance's ID, unique within a record.
pub type Id = u32;

/// A card print as listed, e.g. `"TEF-23"`.
pub type Print = String;

/// `[print, count]` pairs, as in a decklist.
pub type Contents = Vec<(Print, u32)>;

pub const FORMAT: &str = "porytools-game";
/// The newest record version this code reads and writes.
pub const VERSION: u32 = 1;

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Record {
    pub format: String,
    pub version: u32,
    pub viewpoint: Viewer,
    pub source: Source,
    pub players: [PlayerInfo; 2],
    pub start: Start,
    pub nodes: Vec<Node>,
}

// An `enum` is a type that is exactly one of its variants. Unlike TypeScript unions, each
// variant can carry data (`Player(Player)` holds which player), and `match` must handle
// every variant, so adding one makes the compiler point at every place to update.
// (Plain `//` comments stay in Rust; `///` doc comments also land in the generated TS.)

/// Who a record (or a reveal) is for: one player, or everyone. In JSON, `0`, `1` or `"all"`.
#[derive(TS, Clone, Copy, Debug, PartialEq, Eq)]
#[ts(type = "0 | 1 | \"all\"")]
pub enum Viewer {
    Player(Player),
    All,
}

impl Viewer {
    /// Whether this viewer includes `player`.
    pub fn includes(self, player: Player) -> bool {
        match self {
            Viewer::All => true,
            Viewer::Player(p) => p == player,
        }
    }
}

// Viewer's JSON is a number or the string "all", which derive can't express, so its
// (de)serialization is written by hand. `impl Trait for Type` is how a type gains a trait's
// behavior (a trait is like a TypeScript interface that also carries code).
impl Serialize for Viewer {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Viewer::Player(p) => s.serialize_u8(*p),
            Viewer::All => s.serialize_str("all"),
        }
    }
}

impl<'de> Deserialize<'de> for Viewer {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Repr {
            Player(Player),
            Word(String),
        }
        match Repr::deserialize(d)? {
            Repr::Player(p @ (0 | 1)) => Ok(Viewer::Player(p)),
            Repr::Word(w) if w == "all" => Ok(Viewer::All),
            _ => Err(serde::de::Error::custom("expected 0, 1 or \"all\"")),
        }
    }
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Solver,
    Manual,
    #[serde(rename = "ptcgl-import")]
    PtcglImport,
    Handwritten,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlayerInfo {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub decklist: Option<Contents>,
}

/// A new game: just the two decks. Everything else starts empty.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Start {
    pub players: [StartPlayer; 2],
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StartPlayer {
    pub deck: StartDeck,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StartDeck {
    pub count: u32,
    /// The deck's exact contents, when the viewer knows them (their own deck).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub contents: Option<Contents>,
}

/// One node of the tree: an action, and where it hangs.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    /// Missing: the previous node (or the start, for the first node). `null`: the start.
    /// A number: that earlier node. Three cases, so it's an `Option` of an `Option`.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present"
    )]
    #[ts(optional, type = "number | null")]
    pub parent: Option<Option<usize>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub label: Option<String>,
    pub action: Action,
}

/// serde turns a JSON `null` into `None` before it reaches `Option<Option<_>>`; this keeps
/// "present but null" (`Some(None)`) apart from "missing" (`None`, via `default`).
fn present<'de, D: Deserializer<'de>>(d: D) -> Result<Option<Option<usize>>, D::Error> {
    Option::<usize>::deserialize(d).map(Some)
}

/// Where a record is wrong. `node` is the node index; `change` the change within it.
#[derive(Serialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RecordError {
    pub node: Option<usize>,
    pub change: Option<usize>,
    pub message: String,
}

impl RecordError {
    pub fn record(message: impl Into<String>) -> Self {
        RecordError {
            node: None,
            change: None,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for RecordError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match (self.node, self.change) {
            (Some(n), Some(c)) => write!(f, "node {n}, change {c}: {}", self.message),
            (Some(n), None) => write!(f, "node {n}: {}", self.message),
            _ => write!(f, "{}", self.message),
        }
    }
}

impl Record {
    /// Parses a record and checks its header and tree shape (not its contents: see `fold`).
    ///
    /// `Result<T, E>` is either `Ok(value)` or `Err(error)`; Rust has no exceptions, so
    /// failure is part of the return type. The `?` operator returns early on an `Err`.
    pub fn from_json(json: &str) -> Result<Record, RecordError> {
        let record: Record = serde_json::from_str(json).map_err(|e| RecordError::record(e.to_string()))?;
        record.validate()?;
        Ok(record)
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).expect("records always serialize")
    }

    pub fn validate(&self) -> Result<(), RecordError> {
        if self.format != FORMAT {
            return Err(RecordError::record(format!("not a {FORMAT} record")));
        }
        if self.version > VERSION {
            return Err(RecordError::record(format!(
                "record version {} is newer than this reader ({VERSION})",
                self.version
            )));
        }
        for (i, node) in self.nodes.iter().enumerate() {
            if let Some(Some(p)) = node.parent
                && p >= i
            {
                return Err(RecordError {
                    node: Some(i),
                    change: None,
                    message: format!("parent {p} is not an earlier node"),
                });
            }
        }
        Ok(())
    }

    /// The parent of node `i`: `None` is the start.
    pub fn parent_of(&self, i: usize) -> Option<usize> {
        match self.nodes[i].parent {
            Some(p) => p,
            None => i.checked_sub(1),
        }
    }

    /// The node indexes from the start down to `node`, in order.
    pub fn path_to(&self, node: usize) -> Vec<usize> {
        let mut path = vec![node];
        let mut at = node;
        while let Some(p) = self.parent_of(at) {
            path.push(p);
            at = p;
        }
        path.reverse();
        path
    }

    /// The last node of the main line (first child at each step), or `None` if there are no
    /// nodes.
    pub fn main_line_end(&self) -> Option<usize> {
        let mut at: Option<usize> = None;
        loop {
            let next = (0..self.nodes.len()).find(|&i| self.parent_of(i) == at);
            match next {
                Some(n) => at = Some(n),
                None => return at,
            }
        }
    }
}
