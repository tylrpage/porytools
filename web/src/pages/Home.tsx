import { Link } from 'react-router'

export default function Home() {
  return (
    <>
      <h1>Pokémon TCG deck analysis</h1>
      <p>
        Free tools for Standard-format decks: opening-hand and prize odds, setup simulation, and a
        solver that finds the lines that reach your goal by turn 1–2.
      </p>
      <p>
        <Link to="/odds">Odds</Link>: paste a decklist to see your mulligan chance, the odds of
        drawing by-turn odds for every card, and how likely cards are to be prized.
      </p>
      <p className="muted">Under construction: setup simulation and the solver come next.</p>
    </>
  )
}
