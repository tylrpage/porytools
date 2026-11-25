import CardFace from './CardFace.tsx'
import { useViewer, type ListSection, type Shown } from './context.ts'
import Dialog from './Dialog.tsx'
import { cardName } from './steps.ts'

/** A close-up of one card (the small image scaled up), or a list of a pile's cards. */
export default function ShownDialog({ shown, onClose }: { shown: Shown; onClose: () => void }) {
  const { db } = useViewer()
  if (shown.kind === 'closeUp') {
    const name = cardName(db, shown.print)
    return (
      <Dialog label={shown.print ? name : 'Unknown card'} className="closeup" onClose={onClose}>
        <div className="closeup-card">
          <CardFace db={db} print={shown.print} alt={name} />
        </div>
        {shown.print === null && <p className="muted">Unknown card</p>}
        <Sections sections={shown.sections ?? []} />
      </Dialog>
    )
  }
  return (
    <Dialog label={shown.title} className="card-list" onClose={onClose}>
      <h2>{shown.title}</h2>
      <Sections sections={shown.sections} />
    </Dialog>
  )
}

function Sections({ sections }: { sections: ListSection[] }) {
  const { db, show } = useViewer()
  return sections.map((s, i) => (
    <section key={i} className="list-section">
      {s.label && <h3>{s.label}</h3>}
      {s.items.length > 0 && (
        <ul className="list-cards">
          {s.items.map((item, j) => {
            const name = item.print === null ? 'Unknown' : cardName(db, item.print)
            return (
              <li key={j}>
                <button
                  type="button"
                  aria-label={`${item.count > 1 ? `${item.count} × ` : ''}${name}`}
                  disabled={item.print === null}
                  onClick={() => show({ kind: 'closeUp', print: item.print })}
                >
                  <CardFace db={db} print={item.print} />
                  <span className="list-name">
                    {item.count > 1 && <strong>{item.count} × </strong>}
                    {name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {s.note && <p className="muted">{s.note}</p>}
      {s.items.length === 0 && !s.note && <p className="muted">None</p>}
    </section>
  ))
}
