# data/

Build-time card data pipeline (ROADMAP M1). It fetches PokemonTCG/pokemon-tcg-data, filters
to Standard-legal regulation marks, and emits a compact `cards.json` for the site. It also
holds the PTCG Live set-code → data-ID mapping and the override file for new sets.
