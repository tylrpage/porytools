import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { fixtureData } from '../cards/fixture.ts'
import { choose } from '../odds/deal.ts'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(fixtureData))),
  )
})

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

// 4 Dreepy + 4 Pikachu ex (8 Basics) + 4 Ultra Ball + 48 Psychic Energy.
const LINK = '/odds?d=2.4_TWM-128.4_SSP-57.4_SVI-196.48_SVE-5'
const pct = (p: number) => `${(p * 100).toFixed(1)}%`

describe('odds page', () => {
  it('asks for a deck when there is none', async () => {
    renderAt('/odds')
    expect(await screen.findByText('Paste a decklist to see its odds.')).toBeInTheDocument()
  })

  it('shows the mulligan chance and the per-card table', async () => {
    renderAt(LINK)
    await screen.findByText('Mulligan chance')
    const mulligan = choose(52, 7) / choose(60, 7)
    expect(screen.getByText('Mulligan chance').nextSibling?.textContent).toBe(pct(mulligan))

    // Ultra Ball by turn 1 (8 cards), counting only opening hands with a Basic.
    const row = screen.getByRole('row', { name: /Ultra Ball/ })
    const turn1 = within(row).getAllByRole('cell')[1].textContent
    const hasBasic = 1 - mulligan
    // No Ultra Ball in 8 cards, minus the part where the hand also has no Basic (7 Energy,
    // then the 8th card is one of the other 53, 49 of them not Ultra Ball).
    const noBallWithBasic =
      choose(56, 8) / choose(60, 8) - (choose(48, 7) / choose(60, 7)) * (49 / 53)
    expect(turn1).toBe(pct(1 - noBallWithBasic / hasBasic))
  })

  it('answers a question and updates with the turn', async () => {
    renderAt(LINK)
    await screen.findByText('Mulligan chance')
    const answer = document.querySelector('.answer')!
    const byTurn2 = answer.textContent
    fireEvent.change(screen.getByLabelText('By when'), { target: { value: '4' } })
    expect(Number.parseFloat(answer.textContent!)).toBeGreaterThan(Number.parseFloat(byTurn2!))
  })
})
