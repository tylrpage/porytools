import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { fixtureData } from '../cards/fixture.ts'

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

describe('deck page', () => {
  it('parses a pasted list and shows sections and problems', async () => {
    renderAt('/deck')
    const box = await screen.findByLabelText('Decklist')
    fireEvent.change(box, {
      target: { value: '4 Dreepy TWM 128\n4 Ultra Ball SVI 196\n4 Mystery Card' },
    })
    expect(screen.getByText('8 cards')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Pokémon \(4\)/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Trainer \(4\)/ })).toBeInTheDocument()
    expect(screen.getByText(/Mystery Card isn't a known Standard-legal card/)).toBeInTheDocument()
    expect(screen.getByText(/needs exactly 60/)).toBeInTheDocument()
  })

  it('loads a deck from a share link', async () => {
    renderAt('/deck?d=1.4sv6-128.56sve-5')
    expect(await screen.findByText('60 cards')).toBeInTheDocument()
    expect(screen.getByText('Valid Standard deck')).toBeInTheDocument()
    expect(screen.getByLabelText<HTMLTextAreaElement>('Decklist').value).toContain(
      '4 Dreepy TWM 128',
    )
  })
})
