export default function About() {
  return (
    <>
      <h1>About</h1>
      <p>
        porytools is a free suite of Pokémon TCG deck-analysis tools. Everything runs in your
        browser: there are no accounts and no server, and decklists are shared through the URL.
      </p>
      <h2>What's planned</h2>
      <ul>
        <li>
          Probability calculators: opening hand, mulligans, prizes, and seeing a card by turn N
        </li>
        <li>Setup simulation: how often your deck gets set up when played solo</li>
        <li>
          A solver that reads your decklist and finds lines that reach a chosen goal by turn 1–2,
          with odds and example lines
        </li>
        <li>Mid-game analysis from a recorded game state</li>
      </ul>
      <h2>Source</h2>
      <p>
        The project is open source on <a href="https://github.com/tylrpage/porytools">GitHub</a>.
        This site hosts card text only, never card images.
      </p>
    </>
  )
}
