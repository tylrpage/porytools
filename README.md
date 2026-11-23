# porytools

Free, non-commercial Pokémon TCG deck-analysis tools at **[porytools.com](https://porytools.com)**:
probability calculators, solo setup simulation, and a solver that finds the lines that reach a
chosen goal by turn 1–2. Everything runs in the browser.

See [ROADMAP.md](ROADMAP.md) for milestones and status.

## Layout

| Path       | What                                           |
| ---------- | ---------------------------------------------- |
| `web/`     | The site (Vite + React + TypeScript)           |
| `data/`    | Build-time card data pipeline                  |
| `effects/` | Card effect definitions (effect DSL)           |
| `solver/`  | Rust solver core, built to WASM (coming in M4) |

## Development

Requires Node 24 (see `.node-version`).

```sh
cd web
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run format     # Prettier
npm run build      # typecheck + production build to web/dist
```

## Disclaimer

porytools is a free, non-commercial fan project. It is not affiliated with, endorsed,
sponsored, or approved by Nintendo, The Pokémon Company, Creatures Inc., or GAME FREAK inc.
Pokémon and Pokémon character names are trademarks of Nintendo. This site hosts no card
images.

## License

[MIT](LICENSE)
