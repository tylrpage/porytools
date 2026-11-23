// Build web/public/data/cards.json from PokemonTCG/pokemon-tcg-data, plus the TCGdex sets
// listed in data/config.json (`tcgdexSets`) for sets pokemon-tcg-data doesn't have.
//
//   npm run cards                    (from web/) latest pokemon-tcg-data commit
//   npm run cards -- --commit SHA    pin a specific pokemon-tcg-data commit
//   npm run cards -- --refresh       re-download TCGdex cards (not pinned to a version)
//
// Downloads are cached in data/.cache/, so re-runs are offline and fast.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CardData } from '../../src/cards/types.ts'
import {
  buildCardData,
  type Config,
  type Overrides,
  type RawCard,
  type RawSet,
  type Upstream,
} from './normalize.ts'
import { convertCard, convertSet, type TcgdexCard, type TcgdexSet } from './tcgdex.ts'

const REPO = 'PokemonTCG/pokemon-tcg-data'
const TCGDEX_API = 'https://api.tcgdex.net/v2/en'
const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATA_DIR = join(WEB_DIR, '..', 'data')
const CACHE_DIR = join(DATA_DIR, '.cache')
const OUT_FILE = join(WEB_DIR, 'public', 'data', 'cards.json')

async function latestCommit(): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/master`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'porytools-card-build' },
  })
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`)
  return ((await res.json()) as { sha: string }).sha
}

/** Fetch JSON from a URL, using a cache file when present. */
async function cachedJson<T>(url: string, cacheFile: string): Promise<T> {
  try {
    return JSON.parse(await readFile(cacheFile, 'utf8')) as T
  } catch {
    // Not cached yet.
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`)
  const text = await res.text()
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, text)
  return JSON.parse(text) as T
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchPokemonTcgData(commit: string): Promise<Upstream> {
  const file = <T>(path: string) =>
    cachedJson<T>(
      `https://raw.githubusercontent.com/${REPO}/${commit}/${path}`,
      join(CACHE_DIR, commit, path),
    )
  const sets = await file<RawSet[]>('sets/en.json')
  const lists = await mapLimit(sets, 16, (s) => file<RawCard[]>(`cards/en/${s.id}.json`))
  return { sets, cards: Object.fromEntries(sets.map((s, i) => [s.id, lists[i]])) }
}

/** TCGdex serves full card data one card at a time; a set is ~20–200 requests, cached. */
async function fetchTcgdex(setIds: string[]): Promise<Upstream & { updated: string }> {
  const dir = join(CACHE_DIR, 'tcgdex')
  const result: Upstream & { updated: string } = { sets: [], cards: {}, updated: '' }
  for (const id of setIds) {
    const set = await cachedJson<TcgdexSet>(`${TCGDEX_API}/sets/${id}`, join(dir, `${id}.json`))
    const cards = await mapLimit(set.cards, 8, (c) =>
      cachedJson<TcgdexCard & { updated?: string }>(
        `${TCGDEX_API}/cards/${c.id}`,
        join(dir, id, `${c.id}.json`),
      ),
    )
    const raw = convertSet(set)
    result.sets.push(raw)
    result.cards[raw.id] = cards.map(convertCard)
    for (const c of cards) if (c.updated && c.updated > result.updated) result.updated = c.updated
  }
  return result
}

/**
 * One card per line: small, and git diffs show exactly which cards changed when the data
 * is rebuilt.
 */
function serialize(data: CardData): string {
  const { cards, sets, ...meta } = data
  const head = JSON.stringify(meta).slice(0, -1)
  const list = (items: unknown[]) => `[\n${items.map((x) => JSON.stringify(x)).join(',\n')}\n]`
  return `${head},"sets":${list(sets)},"cards":${list(cards)}}\n`
}

async function main() {
  const args = process.argv.slice(2)
  const commitArg = args.indexOf('--commit')
  const commit = commitArg >= 0 ? args[commitArg + 1] : await latestCommit()
  if (args.includes('--refresh'))
    await rm(join(CACHE_DIR, 'tcgdex'), { recursive: true, force: true })

  const config = JSON.parse(await readFile(join(DATA_DIR, 'config.json'), 'utf8')) as Config
  const overrides = JSON.parse(
    await readFile(join(DATA_DIR, 'overrides.json'), 'utf8'),
  ) as Overrides

  console.log(`${REPO}@${commit}`)
  const primary = await fetchPokemonTcgData(commit)
  const tcgdex = await fetchTcgdex(config.tcgdexSets ?? [])
  console.log(`TCGdex sets: ${tcgdex.sets.map((s) => s.ptcgoCode).join(', ') || 'none'}`)

  // TCGdex fills gaps only: skip a set once pokemon-tcg-data has its code.
  const upstream: Upstream = { sets: [...primary.sets], cards: { ...primary.cards } }
  const extraWarnings: string[] = []
  for (const set of tcgdex.sets) {
    if (primary.sets.some((s) => s.ptcgoCode === set.ptcgoCode)) {
      extraWarnings.push(
        `${REPO} now has ${set.ptcgoCode}; remove it from tcgdexSets in data/config.json`,
      )
      continue
    }
    upstream.sets.push(set)
    upstream.cards[set.id] = tcgdex.cards[set.id]
  }

  const sources: CardData['sources'] = [
    { name: REPO, url: `https://github.com/${REPO}`, version: commit },
  ]
  if (tcgdex.sets.length > 0) {
    sources.push({ name: 'TCGdex', url: 'https://tcgdex.dev', version: tcgdex.updated })
  }
  const { data, warnings, errors } = buildCardData(
    upstream,
    overrides,
    config,
    sources,
    new Date().toISOString().slice(0, 10),
  )

  for (const w of [...extraWarnings, ...warnings]) console.warn(`warning: ${w}`)
  if (errors.length > 0) {
    for (const e of errors) console.error(`error: ${e}`)
    console.error(
      `\n${errors.length} error(s). Fix source gaps with a patch in data/overrides.json.`,
    )
    process.exit(1)
  }

  await mkdir(dirname(OUT_FILE), { recursive: true })
  const json = serialize(data)
  await writeFile(OUT_FILE, json)
  const byKind = Object.groupBy(data.cards, (c) => c.kind)
  console.log(
    `wrote ${OUT_FILE}: ${data.cards.length} cards (${byKind.pokemon?.length ?? 0} Pokémon, ` +
      `${byKind.trainer?.length ?? 0} Trainer, ${byKind.energy?.length ?? 0} Energy), ` +
      `${data.sets.length} sets, ${(json.length / 1024).toFixed(0)} KiB`,
  )
}

await main()
