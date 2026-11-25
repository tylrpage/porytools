import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { fixtureData } from '../cards/fixture.ts'
import { loadSolver } from '../game/solver.ts'
import wasmDataUrl from '../game/wasm/porytools_solver_bg.wasm?inline'

// The page loads the solver without bytes; loading it here first makes that a cache hit.
beforeAll(async () => {
  const bytes = Uint8Array.from(atob(wasmDataUrl.slice(wasmDataUrl.indexOf(',') + 1)), (c) =>
    c.charCodeAt(0),
  )
  await loadSolver(bytes)
})

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(fixtureData))),
  )
})

const renderReplay = () =>
  render(
    <MemoryRouter initialEntries={['/replay']}>
      <App />
    </MemoryRouter>,
  )

const caption = () => document.querySelector('.caption')!.textContent

describe('replay page', () => {
  it('steps through the sample game', async () => {
    renderReplay()
    const slider = await screen.findByRole('slider', { name: 'Action' })
    expect(caption()).toMatch(/Start of the game/)
    const last = Number(slider.getAttribute('max'))
    expect(last).toBeGreaterThan(40)

    fireEvent.click(screen.getByRole('button', { name: 'Next action' }))
    expect(caption()).toMatch(/coin flip/)
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/^Action 1 of/))

    // Keys step and jump turns.
    fireEvent.keyDown(window, { key: 'End' })
    expect(caption()).toMatch(/Game over: Opponent wins/)
    const you = screen.getByRole('region', { name: 'You' })
    expect(within(you).getByRole('button', { name: 'Prizes: 6 cards' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Home' })
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/Your turn 1$/))
  })

  it('draws the board: Pokémon with damage and Energy, piles, a revealed card', async () => {
    renderReplay()
    const slider = await screen.findByRole('slider', { name: 'Action' })
    // Just after the opponent's first attack (action 20 of the Live sample).
    fireEvent.change(slider, { target: { value: '20' } })
    expect(caption()).toMatch(/attacks/)
    const you = screen.getByRole('region', { name: 'You' })
    expect(
      within(you).getByRole('button', { name: /^Active: .*10 damage.*changed by this action/ }),
    ).toBeInTheDocument()
    const opponent = screen.getByRole('region', { name: 'Opponent' })
    expect(
      within(opponent).getByRole('button', { name: 'Bench: ASC 158, MEE 2' }),
    ).toBeInTheDocument()
    expect(
      within(opponent).getByRole('button', { name: /^Discard pile: 2 cards/ }),
    ).toBeInTheDocument()

    // Tapping a pile lists its cards; a card there opens a close-up on top.
    fireEvent.click(within(opponent).getByRole('button', { name: /^Discard pile/ }))
    const list = screen.getByRole('dialog', { name: 'Discard pile (2)' })
    fireEvent.click(within(list).getByRole('button', { name: 'ASC 184' }))
    expect(screen.getByRole('dialog', { name: 'ASC 184' })).toBeInTheDocument()
    fireEvent.click(within(list).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // A revealed card that stays put shows in the caption's strip, highlighted.
    fireEvent.change(slider, { target: { value: '9' } })
    const seen = screen.getByRole('list', { name: 'Looked at or revealed' })
    expect(within(seen).getByRole('button', { name: 'ASC 16' })).toHaveClass('hit')
  })

  it('switches to a branch and shows an all-seeing record as one player', async () => {
    renderReplay()
    fireEvent.click(await screen.findByRole('button', { name: /solver turn 1/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    const log = screen.getByRole('dialog', { name: 'Log' })
    fireEvent.click(within(log).getByRole('button', { name: /Lillie/ }))
    expect(within(log).getByRole('button', { name: /Back to the main line/ })).toBeInTheDocument()

    expect(screen.getByRole('region', { name: 'Player 1' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Viewpoint'), { target: { value: '1' } })
    expect(screen.getByRole('region', { name: 'You' })).toBeInTheDocument()
  })

  it('reports a pasted record that is not JSON', async () => {
    renderReplay()
    fireEvent.click(await screen.findByRole('button', { name: 'Paste a record' }))
    fireEvent.change(screen.getByLabelText('Game record'), { target: { value: '{' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByText(/Not a game record/)).toBeInTheDocument()
  })
})
