import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePinnedRow } from './usePinnedRow.ts'

function Table() {
  const pin = usePinnedRow()
  return (
    <>
      <p>Outside</p>
      <table ref={pin.ref}>
        <tbody>
          {['a', 'b'].map((k) => (
            <tr key={k} data-row={k} className={pin.rowClass(k)}>
              <td>Row {k}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

const row = (k: string) => screen.getByText(`Row ${k}`).closest('tr')!

describe('usePinnedRow', () => {
  it('pins on click, moves to another row, and clears on a second click', () => {
    render(<Table />)
    fireEvent.click(screen.getByText('Row a'))
    expect(row('a')).toHaveClass('pinned')
    fireEvent.click(screen.getByText('Row b'))
    expect(row('a')).not.toHaveClass('pinned')
    expect(row('b')).toHaveClass('pinned')
    fireEvent.click(screen.getByText('Row b'))
    expect(row('b')).not.toHaveClass('pinned')
  })

  it('clears on a click off the rows or on Escape', () => {
    render(<Table />)
    fireEvent.click(screen.getByText('Row a'))
    fireEvent.click(screen.getByText('Outside'))
    expect(row('a')).not.toHaveClass('pinned')
    fireEvent.click(screen.getByText('Row a'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(row('a')).not.toHaveClass('pinned')
  })
})
