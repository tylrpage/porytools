import type { Problem } from '../deck/parse.ts'

export default function Problems({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null
  return (
    <ul className="problems">
      {problems.map((p, i) => (
        <li key={i} className={`problem ${p.severity}`}>
          {p.line !== undefined && <span className="muted">Line {p.line}: </span>}
          {p.message}
        </li>
      ))}
    </ul>
  )
}
