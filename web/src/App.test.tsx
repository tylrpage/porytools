import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('site shell', () => {
  it('shows the disclaimer on every page', () => {
    for (const path of ['/', '/about', '/no-such-page']) {
      const { unmount } = renderAt(path)
      expect(screen.getByText(/not affiliated with/i)).toBeInTheDocument()
      unmount()
    }
  })

  it('renders the about page', () => {
    renderAt('/about')
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
  })

  it('renders a 404 for unknown routes', () => {
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument()
  })
})
