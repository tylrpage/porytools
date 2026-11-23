// Shown in the footer of every page. Keep wording in sync with README.md.
export const DISCLAIMER =
  'porytools is a free, non-commercial fan project. It is not affiliated with, endorsed, ' +
  'sponsored, or approved by Nintendo, The Pokémon Company, Creatures Inc., or GAME FREAK ' +
  'inc. Pokémon and Pokémon character names are trademarks of Nintendo.'

export default function Disclaimer() {
  return <p className="disclaimer">{DISCLAIMER}</p>
}
