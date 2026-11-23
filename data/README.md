# data/

Inputs for the card database. The build script lives with the site's toolchain in
`web/scripts/cards/`. Run it from `web/`:

```sh
npm run cards                  # latest pokemon-tcg-data commit
npm run cards -- --commit SHA  # a specific pokemon-tcg-data commit
npm run cards -- --refresh     # also re-download the TCGdex sets
```

It fetches [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data)
plus a few sets from [TCGdex](https://tcgdex.dev) (both cached in `data/.cache/`), applies
the overrides, collapses reprints, keeps only Standard-legal cards, and writes
`web/public/data/cards.json`. The output is committed, so site builds never depend on the
sources being reachable, and a rebuild shows up as a reviewable diff (one card per line).
The source versions are recorded in the file.

## Sources

- **pokemon-tcg-data** is the main source. It is deprecated (its API shuts down March
  2027) but the repo stays available and is current through Delta Reign.
- **TCGdex** (MIT-licensed) fills sets pokemon-tcg-data lacks: MEE (Mega Evolution
  Energy) and MEP (Mega Evolution promos) so far. It is also the fallback if
  pokemon-tcg-data stops adding sets. Its gaps: no Tera / Ancient / Future labels and no
  rule boxes (MEGA is inferred from the name), so a TCGdex-only card with one of those
  needs a patch. Its cards are fetched one by one, so only listed sets are downloaded.
- Scrydex (what pokemon-tcg-data recommends) was ruled out: paid, and its terms forbid
  redistributing the data.

## `config.json`

- `oldestLegalMark`: the oldest Standard-legal regulation mark. Every later mark is legal
  too. At rotation, bump it (e.g. `"H"` → `"I"`) and rebuild. Each card in `cards.json`
  carries its newest mark, so the site can also check against a later mark at runtime
  (e.g. an "after rotation" toggle).
- `setCodeAliases`: set codes that decklists use when they differ from PTCG Live's, e.g.
  Limitless writes `SVP` for the promos PTCG Live calls `PR-SV`.
- `excludeSets`: pokemon-tcg-data set IDs to leave out. `me55c` (30th Celebration Classic
  Collection) shares the 30C code with 30th Celebration and isn't Standard-legal.
- `tcgdexSets`: TCGdex set IDs to add. The build warns once pokemon-tcg-data has the same
  set code, so it can be removed.

## `overrides.json`

- `patches`: fields merged over a source card to fix gaps (missing stage, typos). Keyed
  by print ID (`PBL-42`), or by the source's own ID (`zsv10pt5-80`) when the source's
  number is wrong. Same field names as pokemon-tcg-data.
- `sets`, `cards`: sets and cards upstream hasn't added yet (new releases), in upstream's
  format. `cards` is keyed by set ID.

The build warns when an override becomes redundant because upstream caught up, and fails
on cards it can't read (fix those with a patch).

## How cards are built

- **Print IDs** follow PTCG Live: set code and number, e.g. `TWM-128`, `PR-SV-12`,
  `30C-127`, with leading zeros dropped. They don't depend on which source a card came
  from. Two prints with the same ID fail the build.

- **Legality:** a card is legal if any print with identical game text has a legal mark.
  So an old print (e.g. `Ultra Ball BRS 150`) resolves to the same, legal card.
- **Reprint collapsing:** prints merge when their game text matches after removing
  reminder text and rule boxes that follow from the card type (Item / Supporter / Tool /
  Stadium reminders, ACE SPEC, ex, Mega, Tera). The sources include those inconsistently.
  Paragraph splits, energy symbols (`{M}` vs "Metal"), "Nidoran ♀" spacing and a missing
  final period don't count as differences either.
  The build warns about same-name cards that didn't merge, which usually means an
  upstream typo.
- **Trainer names:** upstream adds the pictured character to some names ("Boss's Orders
  (Ghetsis)"); that is dropped, since the card's name for deck building is "Boss's Orders".
- **One print per card:** each card's ID is its newest print at regular rarity (Common,
  Uncommon, Rare, Double Rare, ACE SPEC Rare), falling back to promos and then alternate
  arts. Promos, full arts and older prints all resolve to that card, and the site and
  solver show and work with that print. Share links and exports keep the prints the
  user listed. The ID can move to a newer reprint, so anything that
  stores card IDs (share links, effect files) looks them up by any print ID.
- **Basic Energy:** one card per type, named "Basic Fire Energy" and so on, always legal,
  with every print from every era.
