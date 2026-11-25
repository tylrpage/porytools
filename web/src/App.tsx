import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import Layout from './components/Layout.tsx'
import About from './pages/About.tsx'
import Deck from './pages/Deck.tsx'
import Home from './pages/Home.tsx'
import NotFound from './pages/NotFound.tsx'
import Odds from './pages/Odds.tsx'

// Split off, so only the replay page downloads the WASM solver.
const Replay = lazy(() => import('./pages/Replay.tsx'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="deck" element={<Deck />} />
        <Route path="odds" element={<Odds />} />
        <Route
          path="replay"
          element={
            <Suspense fallback={<p className="muted">Loading…</p>}>
              <Replay />
            </Suspense>
          }
        />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
