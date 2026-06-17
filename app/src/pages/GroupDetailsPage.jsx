import { useEffect, useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createStudent,
  deleteStudent,
  deleteGroup,
  getGroupById,
  resetStudentAccess,
  updateStudent,
} from '../api/mockApi.js'
import { useAuth } from '../auth/useAuth.jsx'
import Button from '../components/Button.jsx'
import GroupSchedulePanel from '../components/GroupSchedulePanel.jsx'
import GroupStudentsPanel from '../components/GroupStudentsPanel.jsx'
import Input from '../components/Input.jsx'
import Modal from '../components/Modal.jsx'
import StatusState from '../components/StatusState.jsx'

function GroupDetailsPage() {
  const { isTeacher, canManageAssignedGroups } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [students, setStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [editStudentModalOpen, setEditStudentModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentNote, setNewStudentNote] = useState('')
  const [newStudentError, setNewStudentError] = useState('')
  const [studentAccess, setStudentAccess] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editingStudentName, setEditingStudentName] = useState('')
  const [editingStudentNote, setEditingStudentNote] = useState('')
  const [editingStudentError, setEditingStudentError] = useState('')
  const [studentDeleteModalOpen, setStudentDeleteModalOpen] = useState(false)
  const [studentDeleteError, setStudentDeleteError] = useState('')
  const [studentDeleting, setStudentDeleting] = useState(false)
  const [deleteGroupName, setDeleteGroupName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('students')

  useEffect(() => {
    async function loadGroupData() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await getGroupById(id)
        const nextStudents = response.students ?? []
        const nextLessons = response.lessons ?? []
        setGroup(response.group)
        setStudents(nextStudents)
        setLessons(nextLessons)
      } catch {
        setGroup(null)
        setStudents([])
        setLessons([])
        setLoadError('Не удалось загрузить группу')
      } finally {
        setLoading(false)
      }
    }

    loadGroupData()
  }, [id])

  async function loadGroup(showLoading = true) {
    if (showLoading) {
      setLoading(true)
    }

    setLoadError('')

    try {
      const response = await getGroupById(id)
      const nextStudents = response.students ?? []
      const nextLessons = response.lessons ?? []
      setGroup(response.group)
      setStudents(nextStudents)
      setLessons(nextLessons)
    } catch {
      setGroup(null)
      setStudents([])
      setLessons([])
      setLoadError('Не удалось загрузить группу')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  async function handleCreateStudent(event) {
    event.preventDefault()

    if (!newStudentName.trim()) {
      setNewStudentError('Введите имя ученика')
      return
    }

    setNewStudentError('')

    const response = await createStudent({
      groupId: id,
      name: newStudentName.trim(),
      note: newStudentNote.trim(),
    })

    setNewStudentName('')
    setNewStudentNote('')
    setStudentModalOpen(false)
    setStudentAccess({
      studentName: newStudentName.trim(),
      ...response.account,
    })
    await loadGroup()
  }

  async function handleShowStudentAccess(student) {
    const response = await resetStudentAccess(student.id)
    setStudentAccess({
      studentName: student.name,
      ...response.account,
    })
  }

  async function handleUpdateStudent(event) {
    event.preventDefault()

    if (!editingStudent || !editingStudentName.trim()) {
      setEditingStudentError('Введите имя ученика')
      return
    }

    setEditingStudentError('')

    await updateStudent(editingStudent.id, {
      name: editingStudentName.trim(),
      note: editingStudentNote.trim(),
    })

    setEditStudentModalOpen(false)
    setEditingStudent(null)
    setEditingStudentName('')
    setEditingStudentNote('')
    await loadGroup()
  }

  async function handleDeleteGroup(event) {
    event.preventDefault()

    if (deleteGroupName.trim() !== group.name) {
      return
    }

    setIsDeleting(true)

    try {
      await deleteGroup(id)
      navigate('/groups')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleDeleteStudent(event) {
    event.preventDefault()

    if (!editingStudent) {
      return
    }

    setStudentDeleting(true)
    setStudentDeleteError('')

    try {
      await deleteStudent(editingStudent.id)
      setStudentDeleteModalOpen(false)
      setEditStudentModalOpen(false)
      setEditingStudent(null)
      setEditingStudentName('')
      setEditingStudentNote('')
      await loadGroup()
    } catch (error) {
      if (error?.response?.status === 404) {
        setStudentDeleteError('Ученик не найден.')
      } else if (error?.response?.status === 403) {
        setStudentDeleteError('Недостаточно прав для удаления ученика.')
      } else {
        setStudentDeleteError('Не удалось удалить ученика. Попробуйте ещё раз.')
      }
    } finally {
      setStudentDeleting(false)
    }
  }

  function openEditStudentModal(student) {
    setEditingStudent(student)
    setEditingStudentName(student.name)
    setEditingStudentNote(student.note || '')
    setStudentDeleteError('')
    setEditStudentModalOpen(true)
  }

  function openDeleteStudentModal() {
    setStudentDeleteError('')
    setEditStudentModalOpen(false)
    setStudentDeleteModalOpen(true)
  }

  if (loading) {
    return (
      <div className="page-grid">
        <StatusState title="Загрузка" description="Загружаю группу..." />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-grid">
        <StatusState
          title="Не удалось открыть группу"
          description={loadError}
          actionLabel="К группам"
          actionTo="/groups"
        />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="page-grid">
        <StatusState
          title="Группа не найдена"
          description="Вернитесь на главную страницу и выберите другую группу."
          actionLabel="К группам"
          actionTo="/groups"
        />
      </div>
    )
  }

  return (
    <div className="page-grid">
      <section className="page-header pulse-in">
        <div className="page-header-main">
          <Link className="back-link" to="/groups">
            Группы
          </Link>
          <h2>{group.name}</h2>
          <div className="page-header-meta">
            <span>{students.length} учеников</span>
            <span>{lessons.length} уроков</span>
          </div>
        </div>
        <div className="page-header-actions">
          {canManageAssignedGroups ? (
            <>
              {activeTab === 'students' ? (
                <Button onClick={() => setStudentModalOpen(true)}>Новый ученик</Button>
              ) : null}
              {isTeacher ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeleteGroupName('')
                    setDeleteModalOpen(true)
                  }}
                >
                  <FiTrash2 />
                  Удалить
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <section className="surface tab-shell pulse-in">
        <div className="group-tabs" role="tablist" aria-label="Разделы группы">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'students'}
            className={`group-tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            Ученики
            <span>{students.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'schedule'}
            className={`group-tab ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Расписание
            <span>{lessons.length}</span>
          </button>
        </div>

        <div className="tab-panel">
          {activeTab === 'students' ? (
            <GroupStudentsPanel
              students={students}
              onAddStudent={() => setStudentModalOpen(true)}
              onEditStudent={openEditStudentModal}
              onShowAccess={handleShowStudentAccess}
              canManage={canManageAssignedGroups}
              canManageAccess={isTeacher}
            />
          ) : (
            <GroupSchedulePanel
              groupId={group.id}
              canManage={canManageAssignedGroups}
              onJournalChange={() => loadGroup(false)}
            />
          )}
        </div>
      </section>

      {canManageAssignedGroups ? (
        <>
          <Modal
            open={studentModalOpen}
            title="Новый ученик"
            description=""
            onClose={() => setStudentModalOpen(false)}
          >
            <form onSubmit={handleCreateStudent}>
              <Input
                label="Имя ученика"
                value={newStudentName}
                onChange={(event) => {
                  setNewStudentName(event.target.value)
                  if (newStudentError) {
                    setNewStudentError('')
                  }
                }}
                placeholder="Например, Ахмад"
                error={newStudentError}
              />
              <Input
                label="Заметка"
                as="textarea"
                value={newStudentNote}
                onChange={(event) => setNewStudentNote(event.target.value)}
                placeholder="Короткая заметка"
              />
              <div className="modal-actions">
                <Button variant="secondary" onClick={() => setStudentModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit">Сохранить</Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={Boolean(studentAccess)}
            title="Доступ ученика"
            description="Логин сохранён, пароль перевыпущен заново. Сохраните его, старый пароль больше не действует."
            onClose={() => setStudentAccess(null)}
          >
            <div className="input-stack">
              <Input
                label="Ученик"
                value={studentAccess?.studentName ?? ''}
                readOnly
              />
              <Input
                label="Логин"
                value={studentAccess?.login ?? ''}
                readOnly
              />
              <Input
                label="Пароль"
                value={studentAccess?.password ?? ''}
                readOnly
              />
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setStudentAccess(null)}>
                Закрыть
              </Button>
            </div>
          </Modal>

          <Modal
            open={editStudentModalOpen}
            title="Изменить ученика"
            description=""
            onClose={() => {
              setEditStudentModalOpen(false)
              setEditingStudent(null)
            }}
          >
            <form onSubmit={handleUpdateStudent}>
              <Input
                label="Имя ученика"
                value={editingStudentName}
                onChange={(event) => {
                  setEditingStudentName(event.target.value)
                  if (editingStudentError) {
                    setEditingStudentError('')
                  }
                }}
                placeholder="Например, Ахмад"
                error={editingStudentError}
              />
              <Input
                label="Заметка"
                as="textarea"
                value={editingStudentNote}
                onChange={(event) => setEditingStudentNote(event.target.value)}
                placeholder="Короткая заметка"
              />
              <div className="modal-actions">
                <Button variant="danger" onClick={openDeleteStudentModal}>
                  <FiTrash2 />
                  Удалить ученика
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditStudentModalOpen(false)
                    setEditingStudent(null)
                  }}
                >
                  Отмена
                </Button>
                <Button type="submit">Сохранить изменения</Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={studentDeleteModalOpen}
            title="Удалить ученика"
            description=""
            onClose={() => {
              if (studentDeleting) {
                return
              }

              setStudentDeleteModalOpen(false)
              setStudentDeleteError('')
            }}
          >
            <form onSubmit={handleDeleteStudent}>
              <div className="danger-note">
                Ученик будет удалён из группы. Это действие нельзя отменить.
                <strong>{editingStudent?.name ?? ''}</strong>
              </div>
              {studentDeleteError ? <p className="input-error">{studentDeleteError}</p> : null}
              <div className="modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStudentDeleteModalOpen(false)
                    setStudentDeleteError('')
                  }}
                  disabled={studentDeleting}
                >
                  Отмена
                </Button>
                <Button type="submit" variant="danger" disabled={studentDeleting}>
                  <FiTrash2 />
                  {studentDeleting ? 'Удаление...' : 'Удалить ученика'}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={deleteModalOpen}
            title="Удалить группу"
            description=""
            onClose={() => {
              if (isDeleting) {
                return
              }

              setDeleteModalOpen(false)
              setDeleteGroupName('')
            }}
          >
            <form onSubmit={handleDeleteGroup}>
              <div className="danger-note">
                Для подтверждения введите точное название группы:
                <strong>{group.name}</strong>
              </div>
              <Input
                label="Название группы"
                value={deleteGroupName}
                onChange={(event) => setDeleteGroupName(event.target.value)}
                placeholder={group.name}
              />
              <div className="modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDeleteModalOpen(false)
                    setDeleteGroupName('')
                  }}
                  disabled={isDeleting}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={deleteGroupName.trim() !== group.name || isDeleting}
                >
                  <FiTrash2 />
                  {isDeleting ? 'Удаление...' : 'Удалить'}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      ) : null}
    </div>
  )
}

export default GroupDetailsPage
