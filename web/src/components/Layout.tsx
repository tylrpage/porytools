import { Link, NavLink, Outlet } from 'react-router'
import Disclaimer from './Disclaimer.tsx'

export default function Layout() {
  return (
    <div className="shell">
      <header className="site-header">
        <Link to="/" className="brand">
          porytools
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <Disclaimer />
      </footer>
    </div>
  )
}
