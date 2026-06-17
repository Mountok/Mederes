import { FiEdit2, FiLock } from 'react-icons/fi'

function StudentList({ students, onEditStudent, onShowAccess, canManage, canManageAccess = canManage }) {
  if (!students.length) {
    return (
      <div className="empty-state">
        <strong>Пока нет учеников</strong>
        <p>Добавьте первого ученика.</p>
      </div>
    )
  }

  return (
    <div className="student-list material-list">
      {students.map((student) => (
        <article key={student.id} className="student-item pulse-in">
          <div>
            <p className="student-name">{student.name}</p>
            {student.note ? <p className="student-subline">{student.note}</p> : null}
          </div>
          {canManage ? (
            <div className="header-actions">
              {canManageAccess ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onShowAccess(student)}
                  aria-label={`Показать доступ ученика ${student.name}`}
                >
                  <FiLock />
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button"
                onClick={() => onEditStudent(student)}
                aria-label={`Изменить заметку ученика ${student.name}`}
              >
                <FiEdit2 />
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}

export default StudentList
