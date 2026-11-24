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
| `solver/`  | Rust solver core (game records now, the solver in M4), built to WASM |

## Development

Requires Node 24 (see `.node-version`), Rust ([rustup](https://rustup.rs); on Windows
`winget install Rustlang.Rustup`, which also wants the Visual Studio C++ build tools) and
wasm-pack (`cargo install wasm-pack`).

```sh
cd web
npm install
npm run wasm       # build the Rust crate to WASM (src/game/wasm); again after Rust changes
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run format     # Prettier
npm run build      # WASM + typecheck + production build to web/dist

cd solver
cargo test         # Rust tests; also regenerates the TS types in web/src/game/types
cargo clippy --all-targets
```

## Disclaimer

porytools is a free, non-commercial fan project. It is not affiliated with, endorsed,
sponsored, or approved by Nintendo, The Pokémon Company, Creatures Inc., or GAME FREAK inc.
Pokémon and Pokémon character names are trademarks of Nintendo. This site hosts no card
images.

## License

[MIT](LICENSE)
