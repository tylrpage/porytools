// The Rust solver core (../solver), compiled to WASM by `npm run wasm`. Records and
// states cross as JSON; their types are generated from the Rust ones (./types, by ts-rs).
import init, * as wasm from './wasm/porytools_solver.js'
import type { Record as GameRecord } from './types/Record'
import type { RecordError } from './types/RecordError'
import type { State } from './types/State'

export type { GameRecord, RecordError, State }

export interface Solver {
  /** The state at `node` (default: the end of the main line). Throws on a bad record. */
  fold(record: GameRecord, node?: number): State
  /** Every consistency error, on all branches. */
  check(record: GameRecord): RecordError[]
  /** An all-seeing record as `player` sees it. */
  project(record: GameRecord, player: 0 | 1): GameRecord
}

const solver: Solver = {
  fold: (record, node) => JSON.parse(wasm.fold(JSON.stringify(record), node)) as State,
  check: (record) => JSON.parse(wasm.check(JSON.stringify(record))) as RecordError[],
  project: (record, player) =>
    JSON.parse(wasm.project(JSON.stringify(record), player)) as GameRecord,
}

let loading: Promise<Solver> | undefined

/**
 * Loads the WASM module once. In the browser it fetches the `.wasm` file Vite bundles; tests
 * pass the file's bytes instead.
 */
export function loadSolver(bytes?: BufferSource): Promise<Solver> {
  loading ??= init(bytes ? { module_or_path: bytes } : undefined).then(() => solver)
  return loading
}
