import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { fixtureData } from '../cards/fixture.ts'
import { choose } from '../odds/deal.ts'

beforeEach(() => {
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

    // Plain first-7 odds for Ultra Ball, once the mulligan rule is switched off.
    fireEvent.click(screen.getByLabelText(/Redraw mulligans/))
    const row = screen.getByRole('row', { name: /Ultra Ball/ })
    const opening = within(row).getAllByRole('cell')[1].textContent
    expect(opening).toBe(pct(1 - choose(56, 7) / choose(60, 7)))
  })

  it('answers a question and updates with the turn order', async () => {
    renderAt(LINK)
    await screen.findByText('Mulligan chance')
    const answer = document.querySelector('.answer')!
    const goingFirst = answer.textContent
    fireEvent.click(screen.getByRole('button', { name: 'Going second' }))
    // One more card seen by turn 2 going second.
    expect(Number.parseFloat(answer.textContent!)).toBeGreaterThan(Number.parseFloat(goingFirst!))
  })
})
