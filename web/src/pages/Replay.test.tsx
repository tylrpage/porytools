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

describe('replay page', () => {
  it('steps through the sample game', async () => {
    renderReplay()
    const slider = await screen.findByRole('slider', { name: 'Event' })
    expect(screen.getByText(/Start of the game/)).toBeInTheDocument()
    const last = Number(slider.getAttribute('max'))
    expect(last).toBeGreaterThan(40)

    fireEvent.click(screen.getByRole('button', { name: 'Next event' }))
    expect(document.querySelector('.replay-event')!.textContent).toMatch(/coin flip/)

    fireEvent.click(screen.getByRole('button', { name: 'Last event' }))
    expect(document.querySelector('.replay-event')!.textContent).toMatch(/Game over: Opponent wins/)
    const you = screen.getByRole('region', { name: 'You' })
    expect(within(you).getByText('Prizes (6)')).toBeInTheDocument()
  })

  it('switches to a branch and shows an all-seeing record as one player', async () => {
    renderReplay()
    fireEvent.click(await screen.findByRole('button', { name: /solver turn 1/ }))
    const log = screen.getByRole('region', { name: 'Events' })
    fireEvent.click(within(log).getByRole('button', { name: /Lillie/ }))
    expect(within(log).getByRole('button', { name: /Back to the main line/ })).toBeInTheDocument()

    expect(screen.getByRole('region', { name: 'Player 1' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Seen by'), { target: { value: '0' } })
    expect(screen.getByRole('region', { name: 'You' })).toBeInTheDocument()
  })

  it('reports a record that is not JSON', async () => {
    renderReplay()
    fireEvent.change(await screen.findByLabelText('Game record'), { target: { value: '{' } })
    expect(screen.getByText(/Not a game record/)).toBeInTheDocument()
  })
})
