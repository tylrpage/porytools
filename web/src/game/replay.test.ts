import { describe, expect, it } from 'vitest'
import { childrenOf, lineThrough, playerName, turnLabel } from './replay'
import type { GameRecord } from './solver'
import type { Node } from './types/Node'

const node = (extra: Partial<Node> = {}): Node => ({
  action: { type: 'checkup', changes: [] },
  ...extra,
})

// 0 → 1 → 2 → 3, with a branch 4 → 5 off node 1, and a second start 6.
const record = {
  nodes: [
    node(),
    node(),
    node(),
    node(),
    node({ parent: 1, label: 'B' }),
    node(),
    node({ parent: null }),
  ],
} as GameRecord

describe('replay helpers', () => {
  it('walks the tree', () => {
    expect(childrenOf(record, null)).toEqual([0, 6])
    expect(childrenOf(record, 1)).toEqual([2, 4])
    expect(lineThrough(record)).toEqual([0, 1, 2, 3])
    expect(lineThrough(record, 4)).toEqual([0, 1, 4, 5])
    expect(lineThrough(record, 1)).toEqual([0, 1, 2, 3])
    expect(lineThrough(record, 6)).toEqual([6])
  })

  it('names players and turns from the viewpoint', () => {
    expect(playerName(0, 0)).toBe('You')
    expect(playerName(0, 1)).toBe('Opponent')
    expect(playerName('all', 1)).toBe('Player 2')
    expect(turnLabel(0, 1, 0)).toBe('Setup')
    // Player 1 (the viewer) goes second: global turn 2 is their turn 1, turn 3 the opponent's 2.
    expect(turnLabel(2, 0, 1)).toBe('Your turn 1')
    expect(turnLabel(3, 0, 1)).toBe("Opponent's turn 2")
    expect(turnLabel(4, 0, 'all')).toBe("Player 2's turn 2")
  })
})
