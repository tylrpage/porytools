// Collect real tournament decklists from limitlesstcg.com into data/test-decklists.json,
// for internal tests only (parser and card-data coverage now, solver regression later).
// The site never shows these; users import their own lists.
//
//   npm run fetch-decklists                               top 10 archetypes, 5 lists each
//   npm run fetch-decklists -- --archetypes 20 --lists 8
//   npm run fetch-decklists -- --refresh                  ignore the cache
//
// Only the decklists are stored (no players, placements or meta shares). The index and
// archetype pages are read just to find list IDs. Pages are cached in
// data/.cache/limitless/ and fetched at most one per second.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArchetypeIds, parseDecklistPage, parseListIds } from './limitless.ts'

const SITE = 'https://limitlesstcg.com'
const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATA_DIR = join(WEB_DIR, '..', 'data')
const CACHE_DIR = join(DATA_DIR, '.cache', 'limitless')
const OUT_FILE = join(DATA_DIR, 'test-decklists.json')
const DELAY_MS = 1000

export interface TestDecklists {
  source: string
  fetchedAt: string
  /** Keyed by Limitless list ID; each list in PTCG Live export format, one line per entry. */
  lists: Record<string, string[]>
}

let lastRequest = 0

/** GET a page on the site, from the cache when present, otherwise rate-limited. */
async function page(path: string): Promise<string> {
  const name = path.replace(/^\//, '').replaceAll('/', '_') || 'index'
  const cached = join(CACHE_DIR, `${name}.html`)
  try {
    return await readFile(cached, 'utf8')
  } catch {
    // Not cached yet.
  }
  const wait = lastRequest + DELAY_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequest = Date.now()
  const res = await fetch(`${SITE}${path}`, { headers: { 'User-Agent': 'porytools-tests' } })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`)
  const html = await res.text()
  await mkdir(dirname(cached), { recursive: true })
  await writeFile(cached, html)
  return html
}

function numberArg(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(name)
  const value = i >= 0 ? Number(args[i + 1]) : fallback
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} needs a positive number`)
  return value
}

async function main() {
  const args = process.argv.slice(2)
  const archetypeCount = numberArg(args, '--archetypes', 10)
  const listCount = numberArg(args, '--lists', 5)
  if (args.includes('--refresh')) await rm(CACHE_DIR, { recursive: true, force: true })

  const archetypes = parseArchetypeIds(await page('/decks')).slice(0, archetypeCount)
  if (archetypes.length === 0) throw new Error('no archetypes found; did the page change?')

  const lists: Record<string, string[]> = {}
  for (const archetype of archetypes) {
    for (const id of parseListIds(await page(`/decks/${archetype}`)).slice(0, listCount)) {
      lists[id] ??= parseDecklistPage(await page(`/decks/list/${id}`))
    }
  }

  const out: TestDecklists = {
    source: SITE,
    fetchedAt: new Date().toISOString().slice(0, 10),
    lists,
  }
  await mkdir(dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`wrote ${Object.keys(lists).length} decklists to ${OUT_FILE}`)
}

await main()
