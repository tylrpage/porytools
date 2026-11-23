// Parsers for limitlesstcg.com deck pages, used only to collect real decklists for internal
// tests (the site never shows meta data or decklists; users import their own). Pure
// functions over HTML strings; `fetch-decklists.ts` does the fetching. These read the
// site's markup, so a redesign there breaks them: the tests show the expected shape.

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function decodeHtml(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
      return String.fromCodePoint(n)
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

/** Unique matches of a pattern's first group, as numbers, in page order. */
function uniqueIds(html: string, pattern: RegExp): number[] {
  return [...new Set([...html.matchAll(pattern)].map((m) => Number(m[1])))]
}

/** limitlesstcg.com/decks: archetype IDs, in the order the page lists them. */
export function parseArchetypeIds(html: string): number[] {
  return uniqueIds(html, /href="\/decks\/(\d+)"/g)
}

/**
 * limitlesstcg.com/decks/<id>: IDs of the archetype's recent lists, in page order. Players
 * with an identical 60 share one list, so IDs are deduplicated.
 */
export function parseListIds(html: string): number[] {
  return uniqueIds(html, /href="\/decks\/list\/(\d+)"/g)
}

/**
 * limitlesstcg.com/decks/list/<id>: the decklist, in PTCG Live export format with section
 * headers, so porytools' own parser reads it.
 */
export function parseDecklistPage(html: string): string[] {
  const sections: Record<string, string[]> = { pokemon: [], trainer: [], energy: [] }
  for (const part of html.split('class="decklist-card"').slice(1)) {
    const tag = part.slice(0, part.indexOf('>'))
    const attr = (name: string) =>
      decodeHtml(new RegExp(`data-${name}="([^"]*)"`).exec(tag)?.[1] ?? '')
    const count = /<span class="card-count">(\d+)<\/span>/.exec(part)?.[1]
    const type = attr('type')
    if (!count || !sections[type]) throw new Error(`unreadable decklist card: ${tag.slice(0, 120)}`)
    sections[type].push(`${count} ${attr('name')} ${attr('set')} ${attr('number')}`)
  }
  const out: string[] = []
  const headings: [string, string][] = [
    ['pokemon', 'Pokémon'],
    ['trainer', 'Trainer'],
    ['energy', 'Energy'],
  ]
  for (const [key, label] of headings) {
    const list = sections[key]
    if (list.length === 0) continue
    const total = list.reduce((n, l) => n + Number(l.split(' ')[0]), 0)
    out.push(`${label}: ${total}`, ...list)
  }
  return out
}
