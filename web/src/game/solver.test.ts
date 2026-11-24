// The WASM build works from TypeScript: folds the Rust test fixtures and agrees with the
// generated types. (The Rust tests cover the fold itself.) Files load through Vite imports,
// since app code is type-checked without Node's types.
import { describe, expect, it } from 'vitest'
import { loadSolver, type GameRecord } from './solver'
import wasmDataUrl from './wasm/porytools_solver_bg.wasm?inline'
import liveGame from '../../../solver/tests/fixtures/ptcgl-game.json?raw'
import solverOpening from '../../../solver/tests/fixtures/solver-opening.json?raw'

const fixtures = { 'ptcgl-game.json': liveGame, 'solver-opening.json': solverOpening }
const fixture = (name: keyof typeof fixtures) => JSON.parse(fixtures[name]) as GameRecord
const wasmBytes = () =>
  Uint8Array.from(atob(wasmDataUrl.slice(wasmDataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0))

describe('solver (WASM)', () => {
  it('folds the PTCG Live game to its end', async () => {
    const solver = await loadSolver(wasmBytes())
    const record = fixture('ptcgl-game.json')
    expect(solver.check(record)).toEqual([])
    const end = solver.fold(record)
    expect(end.result).toEqual({ winner: 1, reason: 'noPokemon' })
    expect(end.turn).toBe(6)
    expect(end.players[1].active?.stack).toEqual([115, 124, 120])
    // Mid-game: after your turn 1.
    expect(solver.fold(record, 13).players[0].bench[0].attached).toEqual([14])
  })

  it('projects an all-seeing record', async () => {
    const solver = await loadSolver(wasmBytes())
    const mine = solver.project(fixture('solver-opening.json'), 0)
    expect(mine.viewpoint).toBe(0)
    const prizes = solver.fold(mine).players[0].prizes
    expect(prizes).toHaveLength(6)
  })

  it('reports bad records', async () => {
    const solver = await loadSolver(wasmBytes())
    const record = fixture('solver-opening.json')
    expect(() => solver.fold({ ...record, version: 99 })).toThrow(/newer/)
    const broken = structuredClone(record)
    broken.nodes[1].action.changes = []
    expect(solver.check(broken)[0]).toMatchObject({
      node: 2,
      message: expect.stringMatching(/not a live instance/),
    })
  })
})
