import { useEffect, useState } from 'react'
import { FiArrowLeft, FiEdit2, FiTrash2, FiUserCheck, FiUserX } from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'
import {
  deleteLesson,
  getLessonById,
  setAttendanceForAll,
  updateAttendance,
  updateLesson,
} from '../api/mockApi.js'
import { useAuth } from '../auth/useAuth.jsx'
import AttendanceRow from '../components/AttendanceRow.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Modal from '../components/Modal.jsx'
import StatusState from '../components/StatusState.jsx'

const MAX_SCORE = 10

function LessonPage() {
  const { canManageAssignedGroups } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(null)
  const [group, setGroup] = useState(null)
  const [attendanceRows, setAttendanceRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState('saved')
  const [loadError, setLoadError] = useState('')
  const [editLessonModalOpen, setEditLessonModalOpen] = useState(false)
  const [editingLessonTopic, setEditingLessonTopic] = useState('')
  const [editingLessonHomework, setEditingLessonHomework] = useState('')
  const [editingLessonError, setEditingLessonError] = useState('')
  const [lessonUpdating, setLessonUpdating] = useState(false)
  const [deleteLessonModalOpen, setDeleteLessonModalOpen] = useState(false)
  const [lessonDeleteError, setLessonDeleteError] = useState('')
  const [lessonDeleting, setLessonDeleting] = useState(false)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [activeEntryRow, setActiveEntryRow] = useState(null)
  const [entryAttendance, setEntryAttendance] = useState('present')
  const [entryGrade, setEntryGrade] = useState('')
  const [entryError, setEntryError] = useState('')
  const [entrySaving, setEntrySaving] = useState(false)

  useEffect(() => {
    async function loadLessonData() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await getLessonById(id)
        setLesson(response.lesson)
        setGroup(response.group)
        setAttendanceRows(response.attendanceRows ?? [])
      } catch {
        setLesson(null)
        setGroup(null)
        setAttendanceRows([])
        setLoadError('Не удалось загрузить урок')
      } finally {
        setLoading(false)
      }
    }

    loadLessonData()
  }, [id])

  async function syncLesson(update) {
    setSaveState('saving')
    const response = await update
    setLesson(response.lesson)
    setGroup(response.group)
    setAttendanceRows(response.attendanceRows ?? [])
    setSaveState('saved')
  }

  function handleMarkAll(attended) {
    syncLesson(setAttendanceForAll(id, attended))
  }

  function openEntryModal(row) {
    setActiveEntryRow(row)
    setEntryAttendance(row.attended === false ? 'absent' : 'present')
    setEntryGrade(row.grade !== null ? String(row.grade) : '')
    setEntryError('')
    setEntryModalOpen(true)
  }

  function handleGoBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(group ? `/group/${group.id}` : '/groups')
  }

  function openEditLessonModal() {
    setEditingLessonTopic(lesson?.topic ?? '')
    setEditingLessonHomework(lesson?.homework ?? '')
    setEditingLessonError('')
    setEditLessonModalOpen(true)
  }

  async function handleSaveEntry(event) {
    event.preventDefault()

    if (!activeEntryRow) {
      return
    }

    const normalizedGrade = entryGrade.trim()

    if (entryAttendance === 'present' && normalizedGrade) {
      const gradeValue = Number(normalizedGrade)
      const isInvalidGrade =
        !Number.isInteger(gradeValue) || gradeValue < 1 || gradeValue > MAX_SCORE

      if (isInvalidGrade) {
        setEntryError(`Балл должен быть от 1 до ${MAX_SCORE}`)
        return
      }
    }

    setEntrySaving(true)
    setEntryError('')
    setSaveState('saving')

    try {
      let response = await updateAttendance({
        lessonId: id,
        studentId: activeEntryRow.studentId,
        attended: entryAttendance === 'present',
      })

      response = await updateAttendance({
        lessonId: id,
        studentId: activeEntryRow.studentId,
        grade: entryAttendance === 'present' && normalizedGrade ? Number(normalizedGrade) : null,
      })

      setLesson(response.lesson)
      setGroup(response.group)
      setAttendanceRows(response.attendanceRows ?? [])
      setEntryModalOpen(false)
      setActiveEntryRow(null)
      setSaveState('saved')
    } catch {
      setEntryError('Не удалось сохранить отметку. Попробуйте ещё раз.')
      setSaveState('saved')
    } finally {
      setEntrySaving(false)
    }
  }

  async function handleUpdateLesson(event) {
    event.preventDefault()

    if (!editingLessonTopic.trim()) {
      setEditingLessonError('Введите тему урока')
      return
    }

    setLessonUpdating(true)
    setEditingLessonError('')

    try {
      const response = await updateLesson(id, {
        topic: editingLessonTopic.trim(),
        homework: editingLessonHomework.trim(),
      })

      if (response.lesson) {
        setLesson(response.lesson)
      } else {
        setLesson((currentLesson) => (
          currentLesson
            ? {
                ...currentLesson,
                topic: editingLessonTopic.trim(),
                homework: editingLessonHomework.trim(),
              }
            : currentLesson
        ))
      }

      if (response.group) {
        setGroup(response.group)
      }

      if (Array.isArray(response.attendanceRows)) {
        setAttendanceRows(response.attendanceRows)
      }

      setEditLessonModalOpen(false)
    } catch (error) {
      if (error?.response?.status === 400) {
        setEditingLessonError('Введите корректную тему урока.')
      } else if (error?.response?.status === 403) {
        setEditingLessonError('Недостаточно прав для изменения урока.')
      } else if (error?.response?.status === 404) {
        setEditingLessonError('Урок не найден.')
      } else {
        setEditingLessonError('Не удалось сохранить тему урока. Попробуйте ещё раз.')
      }
    } finally {
      setLessonUpdating(false)
    }
  }

  async function handleDeleteLesson(event) {
    event.preventDefault()

    if (!lesson) {
      return
    }

    setLessonDeleting(true)
    setLessonDeleteError('')

    try {
      await deleteLesson(lesson.id)
      navigate(group ? `/group/${group.id}` : '/groups')
    } catch (error) {
      if (error?.response?.status === 403) {
        setLessonDeleteError('Недостаточно прав для удаления урока.')
      } else if (error?.response?.status === 404) {
        setLessonDeleteError('Урок уже удалён или не найден.')
      } else {
        setLessonDeleteError('Не удалось удалить урок. Попробуйте ещё раз.')
      }
    } finally {
      setLessonDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-grid">
        <StatusState title="Загрузка" description="Загружаю урок..." />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-grid">
        <StatusState
          title="Не удалось открыть урок"
          description={loadError}
          actionLabel="К группам"
          actionTo="/groups"
        />
      </div>
    )
  }

  if (!lesson || !group) {
    return (
      <div className="page-grid">
        <StatusState
          title="Урок не найден"
          description="Вернитесь в группу и откройте другой урок."
          actionLabel="К группам"
          actionTo="/groups"
        />
      </div>
    )
  }

  const presentCount = attendanceRows.filter((row) => row.attended === true).length
  const absentCount = attendanceRows.filter((row) => row.attended === false).length
  const scoredCount = attendanceRows.filter((row) => row.grade !== null).length

  return (
    <div className="page-grid">
      <section className="page-header pulse-in">
        <div className="page-header-main">
          <button className="back-link back-link-button" type="button" onClick={handleGoBack}>
            <FiArrowLeft />
            Назад
          </button>
          <h2>{lesson.topic}</h2>
          <div className="page-header-meta">
            <span>{lesson.date}</span>
            <span>{presentCount} были</span>
            <span>{absentCount} отсутствовали</span>
            {scoredCount ? <span>{scoredCount} с баллами</span> : null}
            {canManageAssignedGroups ? <span>{saveState === 'saving' ? 'Сохраняю...' : 'Сохранено'}</span> : null}
          </div>
        </div>
        <div className="page-header-actions">
          {canManageAssignedGroups ? (
            <>
              <Button variant="secondary" onClick={openEditLessonModal}>
                <FiEdit2 />
                Изменить тему
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setLessonDeleteError('')
                  setDeleteLessonModalOpen(true)
                }}
              >
                <FiTrash2 />
                Удалить урок
              </Button>
              <Button onClick={() => handleMarkAll(true)}>
                <FiUserCheck />
                Все были
              </Button>
              <Button variant="danger" onClick={() => handleMarkAll(false)}>
                <FiUserX />
                Все отсутствовали
              </Button>
            </>
          ) : null}
        </div>
      </section>

      <section className="surface pulse-in">
        <div className="attendance-head">
          <div>
            <h3>{canManageAssignedGroups ? 'Ведомость урока' : 'Результаты урока'}</h3>
            {lesson.homework ? (
              <p className="lesson-homework">
                <strong>Домашнее задание:</strong> {lesson.homework}
              </p>
            ) : null}
          </div>
        </div>

        <div className="lesson-sheet-head">
          <span>Ученик</span>
          <span>{lesson.date}</span>
        </div>

        <div className="attendance-board">
          {attendanceRows.length ? (
            attendanceRows.map((row, index) => (
              <AttendanceRow
                key={row.studentId}
                row={row}
                index={index}
                onOpenEditor={openEntryModal}
                readOnly={!canManageAssignedGroups}
              />
            ))
          ) : (
            <div className="empty-state">
              <strong>Пока нет учеников</strong>
              <p>Добавьте учеников в группу, чтобы отмечать этот урок.</p>
            </div>
          )}
        </div>
      </section>

      {canManageAssignedGroups ? (
        <Modal
          open={entryModalOpen}
          title={activeEntryRow ? activeEntryRow.studentName : 'Отметка'}
          description=""
          onClose={() => {
            if (entrySaving) {
              return
            }

            setEntryModalOpen(false)
            setActiveEntryRow(null)
            setEntryError('')
          }}
        >
          <form onSubmit={handleSaveEntry}>
            <div className="entry-status-group" role="radiogroup" aria-label="Статус урока">
              <button
                type="button"
                className={`entry-status-button ${entryAttendance === 'present' ? 'active' : ''}`}
                onClick={() => setEntryAttendance('present')}
              >
                Был
              </button>
              <button
                type="button"
                className={`entry-status-button entry-status-absent ${entryAttendance === 'absent' ? 'active' : ''}`}
                onClick={() => setEntryAttendance('absent')}
              >
                Н
              </button>
            </div>

            <Input
              label="Балл"
              type="number"
              min="1"
              max={MAX_SCORE}
              inputMode="numeric"
              value={entryGrade}
              onChange={(event) => {
                setEntryGrade(event.target.value)
                if (entryError) {
                  setEntryError('')
                }
              }}
              error={entryError}
              disabled={entryAttendance === 'absent'}
              placeholder={entryAttendance === 'absent' ? 'Недоступно' : `1 - ${MAX_SCORE}`}
            />

            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setEntryModalOpen(false)
                  setActiveEntryRow(null)
                  setEntryError('')
                }}
                disabled={entrySaving}
              >
                Закрыть
              </Button>
              <Button type="submit" disabled={entrySaving}>
                {entrySaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {canManageAssignedGroups ? (
        <Modal
          open={editLessonModalOpen}
          title="Изменить тему урока"
          description=""
          onClose={() => {
            if (lessonUpdating) {
              return
            }

            setEditLessonModalOpen(false)
            setEditingLessonError('')
          }}
        >
          <form onSubmit={handleUpdateLesson}>
            <Input
              label="Тема урока"
              value={editingLessonTopic}
              onChange={(event) => {
                setEditingLessonTopic(event.target.value)
                if (editingLessonError) {
                  setEditingLessonError('')
                }
              }}
              error={editingLessonError}
            />
            <Input
              label="Домашнее задание"
              as="textarea"
              value={editingLessonHomework}
              onChange={(event) => setEditingLessonHomework(event.target.value)}
              placeholder="Например, повторить аяты 1-5"
            />
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditLessonModalOpen(false)
                  setEditingLessonError('')
                }}
                disabled={lessonUpdating}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={lessonUpdating}>
                {lessonUpdating ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {canManageAssignedGroups ? (
        <Modal
          open={deleteLessonModalOpen}
          title="Удалить урок"
          description=""
          onClose={() => {
            if (lessonDeleting) {
              return
            }

            setDeleteLessonModalOpen(false)
            setLessonDeleteError('')
          }}
        >
          <form onSubmit={handleDeleteLesson}>
            <div className="danger-note">
              Урок и все его отметки будут удалены.
              <strong>{lesson.topic}</strong>
            </div>
            {lessonDeleteError ? <p className="input-error">{lessonDeleteError}</p> : null}
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteLessonModalOpen(false)
                  setLessonDeleteError('')
                }}
                disabled={lessonDeleting}
              >
                Отмена
              </Button>
              <Button type="submit" variant="danger" disabled={lessonDeleting}>
                <FiTrash2 />
                {lessonDeleting ? 'Удаление...' : 'Удалить урок'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

export default LessonPage
