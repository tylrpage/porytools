//! The functions the site calls (through `wasm-bindgen`). Records and results cross as JSON
//! strings, typed on the TS side by the types ts-rs generates (`web/src/game/types/`).
//!
//! `#[wasm_bindgen]` generates the JavaScript glue. A Rust `Err` becomes a thrown JS
//! exception (`JsError`).

use wasm_bindgen::prelude::*;

use crate::game::{self, Record};

fn parse(record: &str) -> Result<Record, JsError> {
    Record::from_json(record).map_err(|e| JsError::new(&e.to_string()))
}

/// The state at `node` (`undefined`: the end of the main line) as JSON.
#[wasm_bindgen]
pub fn fold(record: &str, node: Option<u32>) -> Result<String, JsError> {
    let record = parse(record)?;
    let node = match node {
        Some(n) => Some(n as usize),
        None => record.main_line_end(),
    };
    let state = game::fold(&record, node).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(serde_json::to_string(&state)?)
}

/// Every consistency error in the record (all branches), as a JSON array of `RecordError`.
#[wasm_bindgen]
pub fn check(record: &str) -> Result<String, JsError> {
    let record = parse(record)?;
    Ok(serde_json::to_string(&game::check(&record))?)
}

/// An all-seeing record as one player sees it, as JSON.
#[wasm_bindgen]
pub fn project(record: &str, player: u8) -> Result<String, JsError> {
    let record = parse(record)?;
    let projected = game::project(&record, player).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(projected.to_json())
}
