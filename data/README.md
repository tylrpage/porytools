# data/

Inputs for the card database. The build script lives with the site's toolchain in
`web/scripts/cards/`. Run it from `web/`:

```sh
npm run cards                  # latest upstream commit
npm run cards -- --commit SHA  # a specific upstream commit
```

It fetches [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data)
(cached in `data/.cache/`), applies the overrides, collapses reprints, keeps only
Standard-legal cards, and writes `web/public/data/cards.json`. The output is committed, so
site builds never depend on upstream being reachable, and a rebuild shows up as a
reviewable diff (one card per line). The upstream commit is recorded in the file.

## `config.json`

- `oldestLegalMark`: the oldest Standard-legal regulation mark. Every later mark is legal
  too. At rotation, bump it (e.g. `"H"` → `"I"`) and rebuild. Each card in `cards.json`
  carries its newest mark, so the site can also check against a later mark at runtime
  (e.g. an "after rotation" toggle).
- `setCodeAliases`: set codes that decklists use when upstream's code differs, e.g.
  Limitless writes `SVP` for the promos PTCG Live calls `PR-SV`.

## `overrides.json`

- `patches`: fields merged over an upstream card, by ID, to fix upstream gaps (missing
  stage, typos). Same field names as upstream.
- `sets`, `cards`: sets and cards upstream hasn't added yet (new releases), in upstream's
  format. `cards` is keyed by set ID.

The build warns when an override becomes redundant because upstream caught up, and fails
on cards it can't read (fix those with a patch).

## How cards are built

- **Legality:** a card is legal if any print with identical game text has a legal mark.
  So an old print (e.g. `Ultra Ball BRS 150`) resolves to the same, legal card.
- **Reprint collapsing:** prints merge when their game text matches after removing
  reminder text and rule boxes that follow from the card type (Item / Supporter / Tool /
  Stadium reminders, ACE SPEC, ex, Mega, Tera). Upstream includes those inconsistently.
  The build warns about same-name cards that didn't merge, which usually means an
  upstream typo.
- **Trainer names:** upstream adds the pictured character to some names ("Boss's Orders
  (Ghetsis)"); that is dropped, since the card's name for deck building is "Boss's Orders".
- **One print per card:** each card's ID is its newest print at regular rarity (Common,
  Uncommon, Rare, Double Rare, ACE SPEC Rare), falling back to promos and then alternate
  arts. Promos, full arts and older prints all resolve to that card, and the site and
  solver only ever show that print. The ID can move to a newer reprint, so anything that
  stores card IDs (share links, effect files) looks them up by any print ID.
- **Basic Energy:** one card per type, named "Basic Fire Energy" and so on, always legal,
  with every print from every era.
