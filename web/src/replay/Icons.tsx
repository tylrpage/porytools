// Playback icons as inline SVG, not emoji or symbol characters: those draw differently per
// device (iOS turns some into colour emoji). They take the text colour and size, and the
// buttons' aria-label names them.

const paths = {
  prevTurn: 'M2.5 3h2v10h-2zM13.5 3v10L9 8zM9 3v10L4.5 8z',
  prev: 'M11 3v10L5 8z',
  next: 'M5 3v10l6-5z',
  nextTurn: 'M11.5 3h2v10h-2zM2.5 3v10L7 8zM7 3v10l4.5-5z',
}

export type IconName = keyof typeof paths

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="currentColor" />
    </svg>
  )
}
