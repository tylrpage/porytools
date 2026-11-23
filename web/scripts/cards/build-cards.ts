// Build web/public/data/cards.json from PokemonTCG/pokemon-tcg-data.
//
//   npm run cards                 (from web/) latest upstream commit
//   npm run cards -- --commit SHA pin a specific upstream commit
//
// Downloads are cached in data/.cache/<commit>/, so re-runs are offline and fast.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CardData } from '../../src/cards/types.ts'
import {
  buildCardData,
  type Config,
  type Overrides,
  type RawCard,
  type RawSet,
} from './normalize.ts'

const REPO = 'PokemonTCG/pokemon-tcg-data'
const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATA_DIR = join(WEB_DIR, '..', 'data')
const OUT_FILE = join(WEB_DIR, 'public', 'data', 'cards.json')

async function latestCommit(): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/master`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'porytools-card-build' },
  })
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`)
  return ((await res.json()) as { sha: string }).sha
}

/** Fetch a file from the upstream repo at a commit, using the local cache when present. */
async function upstreamFile<T>(commit: string, path: string): Promise<T> {
  const cached = join(DATA_DIR, '.cache', commit, path)
  try {
    return JSON.parse(await readFile(cached, 'utf8')) as T
  } catch {
    // Not cached yet.
  }
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${commit}/${path}`)
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`)
  const text = await res.text()
  await mkdir(dirname(cached), { recursive: true })
  await writeFile(cached, text)
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
  console.log(`upstream ${REPO}@${commit}`)

  const config = JSON.parse(await readFile(join(DATA_DIR, 'config.json'), 'utf8')) as Config
  const overrides = JSON.parse(
    await readFile(join(DATA_DIR, 'overrides.json'), 'utf8'),
  ) as Overrides

  const sets = await upstreamFile<RawSet[]>(commit, 'sets/en.json')
  const lists = await mapLimit(sets, 16, (s) =>
    upstreamFile<RawCard[]>(commit, `cards/en/${s.id}.json`),
  )
  const cards = Object.fromEntries(sets.map((s, i) => [s.id, lists[i]]))

  const { data, warnings, errors } = buildCardData({ sets, cards }, overrides, config, {
    repo: REPO,
    commit,
    fetchedAt: new Date().toISOString().slice(0, 10),
  })

  for (const w of warnings) console.warn(`warning: ${w}`)
  if (errors.length > 0) {
    for (const e of errors) console.error(`error: ${e}`)
    console.error(
      `\n${errors.length} error(s). Fix upstream gaps with a patch in data/overrides.json.`,
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
