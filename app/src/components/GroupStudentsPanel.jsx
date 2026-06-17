import { FiPlus } from 'react-icons/fi'
import Button from './Button.jsx'
import StudentList from './StudentList.jsx'

function GroupStudentsPanel({
  students,
  onAddStudent,
  onEditStudent,
  onShowAccess,
  canManage,
  canManageAccess = canManage,
}) {
  return (
    <section className="group-view pulse-in">
      <div className="panel-headline">
        <h3>Ученики</h3>
        {canManage ? (
          <Button variant="secondary" onClick={onAddStudent}>
            <FiPlus />
            Добавить ученика
          </Button>
        ) : null}
      </div>

      <StudentList
        students={students}
        onEditStudent={onEditStudent}
        onShowAccess={onShowAccess}
        canManage={canManage}
        canManageAccess={canManageAccess}
      />
    </section>
  )
}

export default GroupStudentsPanel
