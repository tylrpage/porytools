// Hand-written sample records for the replay viewer. They are the Rust tests' fixtures, so
// `cargo test` keeps them valid.
import liveGame from '../../../solver/tests/fixtures/ptcgl-game.json?raw'
import solverOpening from '../../../solver/tests/fixtures/solver-opening.json?raw'

export const SAMPLES: { name: string; json: string }[] = [
  { name: 'Sample: a PTCG Live game', json: liveGame },
  { name: 'Sample: solver turn 1, with a branch', json: solverOpening },
]
