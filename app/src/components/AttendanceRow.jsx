function getCellLabel(row) {
  if (row.attended === false) {
    return 'Н'
  }

  if (row.grade !== null) {
    return String(row.grade)
  }

  if (row.attended === true) {
    return 'Б'
  }

  return ''
}

function getCellTone(row) {
  if (row.attended === false) {
    return 'is-absent'
  }

  if (row.grade !== null) {
    return 'is-graded'
  }

  if (row.attended === true) {
    return 'is-present'
  }

  return ''
}

function AttendanceRow({ row, index, onOpenEditor, readOnly = false }) {
  const cellLabel = getCellLabel(row)
  const cellTone = getCellTone(row)
  const cellClassName = ['lesson-sheet-cell', cellTone].join(' ').trim()

  return (
    <article className="lesson-sheet-row pulse-in">
      <div className="lesson-sheet-student">
        <span className="lesson-sheet-index">{index + 1}</span>
        <div className="attendance-student">
          <strong className="student-name">{row.studentName}</strong>
          {row.note ? <span className="meta-line">{row.note}</span> : null}
        </div>
      </div>

      {readOnly ? (
        <div className={cellClassName}>
          <span>{cellLabel || '\u00A0'}</span>
        </div>
      ) : (
        <button
          type="button"
          className={`${cellClassName} lesson-sheet-cell-button`}
          onClick={() => onOpenEditor(row)}
          aria-label={`Изменить отметку ученика ${row.studentName}`}
        >
          <span>{cellLabel || '\u00A0'}</span>
        </button>
      )}
    </article>
  )
}

export default AttendanceRow
