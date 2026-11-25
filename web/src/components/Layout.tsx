import { Link, NavLink, Outlet, useMatch } from 'react-router'
import Disclaimer from './Disclaimer.tsx'

export default function Layout() {
  // The replay board uses the whole window: full width, and exactly the height under the
  // header, with the footer below the fold.
  const wide = useMatch('/replay') !== null
  return (
    <div className={wide ? 'shell wide' : 'shell'}>
      <div className="screen">
        <header className="site-header">
          <Link to="/" className="brand">
            porytools
          </Link>
          <nav aria-label="Main">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/deck">Deck</NavLink>
            <NavLink to="/odds">Odds</NavLink>
            <NavLink to="/replay">Replay</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
      <footer className="site-footer">
        <Disclaimer />
      </footer>
    </div>
  )
}
