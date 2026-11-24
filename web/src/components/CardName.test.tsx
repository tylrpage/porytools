import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '../cards/types.ts'
import CardName from './CardName.tsx'

const applin: Card = {
  kind: 'pokemon',
  id: 'TWM-126',
  name: 'Applin',
  mark: 'H',
  prints: ['TWM-126'],
  image: 'https://images.example/sv6/126.png',
  stage: 'Basic',
  hp: 40,
  types: ['Grass'],
  tags: [],
  abilities: [],
  attacks: [],
  retreat: 1,
  rules: [],
}

afterEach(() => vi.useRealTimers())

describe('CardName', () => {
  // First: once a preview closes, others open without the delay for a moment.
  it('opens on mouse hover after a short delay and closes on leave', () => {
    vi.useFakeTimers()
    render(<CardName card={applin} label="Applin (TWM 126)" />)
    const name = screen.getByRole('button', { name: 'Applin (TWM 126)' })
    fireEvent.pointerEnter(name, { pointerType: 'mouse' })
    expect(screen.queryByRole('img')).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByRole('img')).toBeInTheDocument()
    fireEvent.pointerLeave(name, { pointerType: 'mouse' })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('toggles the card image on tap and closes on Escape', () => {
    render(<CardName card={applin} />)
    const name = screen.getByRole('button', { name: 'Applin' })
    fireEvent.click(name)
    expect(screen.getByRole('img', { name: 'Applin (TWM 126)' })).toHaveAttribute(
      'src',
      applin.image,
    )
    fireEvent.click(name)
    expect(screen.queryByRole('img')).toBeNull()
    fireEvent.click(name)
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('says so when the card has no image', () => {
    render(<CardName card={{ ...applin, image: undefined }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Applin' }))
    expect(screen.getByText(/No card image available/)).toBeInTheDocument()
  })
})
