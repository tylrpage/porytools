//! The game record format (`docs/game-format.md`): types, fold, consistency check,
//! projection. `mod x;` includes the file `x.rs`; `pub use` re-exports its items here.

pub mod action;
pub mod fold;
pub mod project;
pub mod record;
pub mod state;

pub use action::{Action, ActionKind, Change, ChangeKind, Loc, NewCard, Zone};
pub use fold::{check, fold};
pub use project::project;
pub use record::{Id, Player, Print, Record, RecordError, Viewer};
pub use state::State;
