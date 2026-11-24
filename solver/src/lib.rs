//! porytools solver core. Builds natively (for `cargo test` and batch runs) and to WASM
//! for the site, where `wasm.rs`'s functions are what JavaScript calls.

pub mod game;
mod wasm;
