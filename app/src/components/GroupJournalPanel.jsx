import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiBarChart2,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiInfo,
  FiPlus,
  FiExternalLink,
  FiStar,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import {
  createLesson,
  deleteLesson,
  getGroupById,
  getGroupJournal,
  updateAttendance,
  updateLesson,
} from '../api/mockApi.js'
import Button from './Button.jsx'
import Input from './Input.jsx'
import Modal from './Modal.jsx'
import StatusState from './StatusState.jsx'

const MONTH_LABEL = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
})

const WEEK_DAY_LABELS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']

const MAX_SCORE = 10

function parseIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function formatDayLabel(value) {
  return value.slice(-2)
}

function formatWeekDayLabel(value) {
  return WEEK_DAY_LABELS[parseIsoDate(value).getDay()]
}

function formatTopicLabel(value, maxLength = 15) {
  const topic = value?.trim() ?? ''

  return topic.length > maxLength ? `${topic.slice(0, maxLength)}…` : topic
}

function isSameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function isTodayColumn(date, periodStart) {
  return isSameMonth(periodStart, new Date()) && date === toIsoDate(new Date())
}

function getCellLabel(entry) {
  if (!entry) {
    return ''
  }

  if (entry.attended === false) {
    return 'Н'
  }

  if (entry.grade !== null && entry.grade !== undefined) {
    return String(entry.grade)
  }

  return ''
}

function getCellTone(entry) {
  if (!entry) {
    return ''
  }

  if (entry.attended === false) {
    return 'is-absent'
  }

  if (entry.grade !== null && entry.grade !== undefined) {
    return 'is-graded'
  }

  if (entry.attended === true) {
    return 'is-present'
  }

  return ''
}

function sanitizeFileName(value) {
  return String(value)
    .trim()
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, '-')
}

function buildLessonGroups(lessons) {
  return lessons.reduce((accumulator, lesson) => {
    if (!accumulator[lesson.date]) {
      accumulator[lesson.date] = []
    }

    accumulator[lesson.date].push(lesson)
    return accumulator
  }, {})
}

function buildCalendarColumns(from, to, lessons) {
  const lessonsByDate = buildLessonGroups(lessons)
  const columns = []
  const cursor = parseIsoDate(from)
  const end = parseIsoDate(to)

  while (cursor <= end) {
    const isoDate = toIsoDate(cursor)
    const dayLessons = lessonsByDate[isoDate] ?? []

    if (dayLessons.length) {
      dayLessons.forEach((lesson, index) => {
        columns.push({
          date: isoDate,
          label: formatDayLabel(isoDate),
          weekDayLabel: formatWeekDayLabel(isoDate),
          lesson,
          lessonIndex: index + 1,
          lessonsCount: dayLessons.length,
        })
      })
    } else {
      columns.push({
        date: isoDate,
        label: formatDayLabel(isoDate),
        weekDayLabel: formatWeekDayLabel(isoDate),
        lesson: null,
        lessonIndex: 0,
        lessonsCount: 0,
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return columns
}

function buildLessonColumns(lessons) {
  return lessons.map((lesson) => ({
    date: lesson.date,
    label: formatDayLabel(lesson.date),
    weekDayLabel: formatWeekDayLabel(lesson.date),
    lesson,
    lessonIndex: 1,
    lessonsCount: 1,
  }))
}

function buildFallbackJournal(groupDetails, from, to) {
  const lessons = (groupDetails.lessons ?? [])
    .filter((lesson) => lesson.date >= from && lesson.date <= to)
    .map((lesson) => ({
      id: lesson.id,
      groupId: lesson.groupId,
      date: lesson.date,
      topic: lesson.topic,
      homework: lesson.homework ?? '',
    }))

  return {
    group: groupDetails.group,
    period: { from, to },
    students: groupDetails.students ?? [],
    lessons,
    entries: [],
  }
}

function buildJournalWorksheetRows(journal, columns) {
  const entryLookup = Object.fromEntries(
    journal.entries.map((entry) => [`${entry.studentId}:${entry.lessonId}`, entry]),
  )
  const { studentSummaries, groupSummary } = buildJournalSummary(journal)

  const headerRow = ['ФИО', ...columns.map((column) => column.date)]
  const topicRow = ['Тема', ...columns.map((column) => column.lesson?.topic ?? '')]
  const homeworkRow = ['Домашнее задание', ...columns.map((column) => column.lesson?.homework ?? '')]

  const studentRows = journal.students.map((student) => {
    const cells = columns.map((column) => {
      if (!column.lesson) {
        return ''
      }

      return getCellLabel(entryLookup[`${student.id}:${column.lesson.id}`])
    })

    return [student.name, ...cells]
  })

  const summaryRows = [
    [],
    ['Общая сводка'],
    ['Всего учеников', groupSummary.studentsCount],
    ['Сумма баллов группы', groupSummary.scoreTotal],
    ['Средний балл группы', formatAverage(groupSummary.averageScore)],
    ['Всего пропусков', groupSummary.absentTotal],
    [],
    ['ФИО', 'Кол-во отметок', 'Сумма баллов', 'Средний балл', 'Пропуски / Н', 'Последний балл'],
    ...studentSummaries.map((student) => [
      student.name,
      student.scoreCount,
      student.scoreTotal,
      formatAverage(student.averageScore),
      student.absentCount,
      student.lastScore ?? '',
    ]),
  ]

  return [headerRow, topicRow, homeworkRow, ...studentRows, ...summaryRows]
}

async function downloadJournalWorkbook(journal, columns, suffix) {
  const XLSX = await import('xlsx')
  const rows = buildJournalWorksheetRows(journal, columns)
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()

  worksheet['!cols'] = [
    { wch: 32 },
    ...columns.map(() => ({ wch: 8 })),
  ]

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Журнал')

  const fileName = `${sanitizeFileName(journal.group.name)}-${suffix}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

function isScoreValue(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
}

function formatAverage(value) {
  if (value === null || value === undefined) {
    return '—'
  }

  return Number(value).toFixed(1)
}

function buildJournalSummary(journal) {
  const entryLookup = Object.fromEntries(
    journal.entries.map((entry) => [`${entry.studentId}:${entry.lessonId}`, entry]),
  )

  const studentSummaries = journal.students.map((student) => {
    let scoreCount = 0
    let scoreTotal = 0
    let absentCount = 0
    let lastScore = null

    journal.lessons.forEach((lesson) => {
      const entry = entryLookup[`${student.id}:${lesson.id}`]

      if (!entry) {
        return
      }

      if (entry.attended === false) {
        absentCount += 1
      }

      if (isScoreValue(entry.grade)) {
        const score = Number(entry.grade)
        scoreCount += 1
        scoreTotal += score
        lastScore = score
      }
    })

    return {
      id: student.id,
      name: student.name,
      scoreCount,
      scoreTotal,
      averageScore: scoreCount ? scoreTotal / scoreCount : null,
      absentCount,
      lastScore,
    }
  })

  const groupScoreCount = studentSummaries.reduce((total, student) => total + student.scoreCount, 0)
  const groupScoreTotal = studentSummaries.reduce((total, student) => total + student.scoreTotal, 0)
  const groupAbsentTotal = studentSummaries.reduce((total, student) => total + student.absentCount, 0)

  return {
    studentSummaries,
    groupSummary: {
      studentsCount: journal.students.length,
      scoreCount: groupScoreCount,
      scoreTotal: groupScoreTotal,
      averageScore: groupScoreCount ? groupScoreTotal / groupScoreCount : null,
      absentTotal: groupAbsentTotal,
    },
  }
}

function GroupJournalPanel({ groupId, canManage, onJournalChange }) {
  const [periodStart, setPeriodStart] = useState(() => startOfMonth(new Date()))
  const [journal, setJournal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [entryMode, setEntryMode] = useState('grade')
  const [entryGrade, setEntryGrade] = useState('')
  const [entryError, setEntryError] = useState('')
  const [entrySaving, setEntrySaving] = useState(false)
  const [lessonModalOpen, setLessonModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [editingLesson, setEditingLesson] = useState(null)
  const [lessonTopic, setLessonTopic] = useState('')
  const [lessonHomework, setLessonHomework] = useState('')
  const [homeworkLessonColumn, setHomeworkLessonColumn] = useState(null)
  const [lessonError, setLessonError] = useState('')
  const [lessonSaving, setLessonSaving] = useState(false)
  const [deleteLessonModalOpen, setDeleteLessonModalOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState(null)
  const [lessonDeleteError, setLessonDeleteError] = useState('')
  const [lessonDeleting, setLessonDeleting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportingMode, setExportingMode] = useState('')
  const journalScrollRef = useRef(null)

  const from = toIsoDate(startOfMonth(periodStart))
  const to = toIsoDate(endOfMonth(periodStart))

  async function loadJournal(showLoading = true) {
    if (showLoading) {
      setLoading(true)
    }

    setLoadError('')

    try {
      const response = await getGroupJournal(groupId, { from, to })
      setJournal(response)
    } catch (error) {
      if (error?.response?.status === 403) {
        try {
          const groupDetails = await getGroupById(groupId)
          setJournal(buildFallbackJournal(groupDetails, from, to))
          return
        } catch {
          setJournal(null)
          setLoadError('Не удалось загрузить расписание группы')
          return
        }
      }

      setJournal(null)
      setLoadError('Не удалось загрузить журнал группы')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    async function run() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await getGroupJournal(groupId, { from, to })
        setJournal(response)
      } catch (error) {
        if (error?.response?.status === 403) {
          try {
            const groupDetails = await getGroupById(groupId)
            setJournal(buildFallbackJournal(groupDetails, from, to))
            return
          } catch {
            setJournal(null)
            setLoadError('Не удалось загрузить расписание группы')
            return
          }
        }

        setJournal(null)
        setLoadError('Не удалось загрузить журнал группы')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [groupId, from, to])

  useEffect(() => {
    setHomeworkLessonColumn(null)
  }, [groupId, periodStart])

  const columns = useMemo(() => {
    if (!journal) {
      return buildCalendarColumns(from, to, [])
    }

    return buildCalendarColumns(journal.period.from, journal.period.to, journal.lessons)
  }, [journal, from, to])

  const entryLookup = useMemo(() => {
    if (!journal) {
      return {}
    }

    return Object.fromEntries(
      journal.entries.map((entry) => [`${entry.studentId}:${entry.lessonId}`, entry]),
    )
  }, [journal])

  const summary = useMemo(() => {
    if (!journal) {
      return null
    }

    return buildJournalSummary(journal)
  }, [journal])

  const monthLabel = MONTH_LABEL.format(periodStart)

  useEffect(() => {
    if (loading || !journal?.students.length || !isSameMonth(periodStart, new Date())) {
      return
    }

    const container = journalScrollRef.current
    if (!container) {
      return
    }

    const todayHeader = container.querySelector('[data-journal-date-today="true"]')
    if (!todayHeader) {
      return
    }

    const stickyColumn = container.querySelector('.journal-student-head')
    const stickyWidth = stickyColumn?.offsetWidth ?? 240
    const visibleWidth = container.clientWidth - stickyWidth
    const frame = requestAnimationFrame(() => {
      const targetLeft =
        todayHeader.offsetLeft - stickyWidth - visibleWidth / 2 + todayHeader.offsetWidth / 2

      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'auto',
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [loading, journal, columns, periodStart])

  function handleOpenLessonDay(column) {
    if (!canManage && !column.lesson) {
      return
    }

    setSelectedDate(column.date)
    setEditingLesson(column.lesson)
    if (column.lesson) {
      setHomeworkLessonColumn(column)
    }
    setLessonTopic(column.lesson?.topic ?? '')
    setLessonHomework(column.lesson?.homework ?? '')
    setLessonError('')
    setLessonModalOpen(true)
  }

  function handleAddAnotherLesson() {
    setEditingLesson(null)
    setLessonTopic('')
    setLessonHomework('')
    setLessonError('')
  }

  function openDeleteLessonModal() {
    if (!editingLesson) {
      return
    }

    setLessonToDelete(editingLesson)
    setLessonDeleteError('')
    setLessonModalOpen(false)
    setDeleteLessonModalOpen(true)
  }

  function handleOpenEntry(student, lesson, entry) {
    if (!lesson || !canManage) {
      return
    }

    setSelectedStudent(student)
    setSelectedLesson(lesson)
    setHomeworkLessonColumn({
      date: lesson.date,
      label: formatDayLabel(lesson.date),
      weekDayLabel: formatWeekDayLabel(lesson.date),
      lesson,
      lessonIndex: 1,
      lessonsCount: 1,
    })
    setEntryMode(entry?.attended === false ? 'absent' : 'grade')
    setEntryGrade(entry?.grade !== null && entry?.grade !== undefined ? String(entry.grade) : '')
    setEntryError('')
    setEntryModalOpen(true)
  }

  async function handleSaveEntry(event) {
    event.preventDefault()

    if (!selectedStudent || !selectedLesson) {
      return
    }

    const normalizedGrade = entryGrade.trim()

    if (entryMode === 'grade') {
      const gradeValue = Number(normalizedGrade)
      const isInvalidGrade =
        !normalizedGrade || !Number.isInteger(gradeValue) || gradeValue < 1 || gradeValue > MAX_SCORE

      if (isInvalidGrade) {
        setEntryError(`Введите балл от 1 до ${MAX_SCORE}`)
        return
      }
    }

    setEntrySaving(true)
    setEntryError('')

    try {
      await updateAttendance({
        lessonId: selectedLesson.id,
        studentId: selectedStudent.id,
        attended: entryMode === 'grade',
      })

      await updateAttendance({
        lessonId: selectedLesson.id,
        studentId: selectedStudent.id,
        grade: entryMode === 'grade' ? Number(normalizedGrade) : null,
      })

      await loadJournal(false)
      setEntryModalOpen(false)
      setSelectedStudent(null)
      setSelectedLesson(null)
    } catch {
      setEntryError('Не удалось сохранить ячейку. Попробуйте ещё раз.')
    } finally {
      setEntrySaving(false)
    }
  }

  async function handleSaveLesson(event) {
    event.preventDefault()

    if (!canManage) {
      return
    }

    if (!lessonTopic.trim()) {
      setLessonError('Введите тему урока')
      return
    }

    setLessonSaving(true)
    setLessonError('')

    try {
      if (editingLesson) {
        await updateLesson(editingLesson.id, {
          topic: lessonTopic.trim(),
          homework: lessonHomework.trim(),
        })
      } else {
        await createLesson({
          groupId,
          date: selectedDate,
          topic: lessonTopic.trim(),
          homework: lessonHomework.trim(),
        })
      }

      await loadJournal(false)
      await onJournalChange?.()
      setLessonModalOpen(false)
      setSelectedDate('')
      setEditingLesson(null)
      setLessonTopic('')
      setLessonHomework('')
    } catch {
      setLessonError('Не удалось сохранить урок. Попробуйте ещё раз.')
    } finally {
      setLessonSaving(false)
    }
  }

  async function handleDeleteLesson(event) {
    event.preventDefault()

    if (!lessonToDelete) {
      return
    }

    setLessonDeleting(true)
    setLessonDeleteError('')

    try {
      await deleteLesson(lessonToDelete.id)
      await loadJournal(false)
      await onJournalChange?.()
      setDeleteLessonModalOpen(false)
      setLessonToDelete(null)
      setEditingLesson(null)
      setLessonTopic('')
      setLessonHomework('')
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

  async function handleExportCurrentPeriod() {
    if (!journal) {
      return
    }

    setExportingMode('period')
    setExportError('')

    try {
      await downloadJournalWorkbook(journal, columns, `${journal.period.from}_${journal.period.to}`)
    } catch {
      setExportError('Не удалось выгрузить журнал за период.')
    } finally {
      setExportingMode('')
    }
  }

  async function handleExportAllTime() {
    setExportingMode('all')
    setExportError('')

    try {
      const response = await getGroupJournal(groupId, {
        from: '2000-01-01',
        to: '2100-12-31',
      })

      await downloadJournalWorkbook(response, buildLessonColumns(response.lessons), 'all-time')
    } catch {
      setExportError('Не удалось выгрузить журнал за всё время.')
    } finally {
      setExportingMode('')
    }
  }

  if (loading) {
    return <StatusState title="Загрузка" description="Загружаю журнал..." />
  }

  if (loadError) {
    return <StatusState title="Не удалось открыть журнал" description={loadError} />
  }

  if (!journal) {
    return (
      <StatusState
        title="Журнал недоступен"
        description="Попробуйте открыть группу ещё раз."
      />
    )
  }

  const { studentSummaries, groupSummary } = summary

  return (
    <section className="group-view group-journal-panel pulse-in">
      <div className="panel-headline">
        <div>
          <h3>Расписание</h3>
          <p className="panel-subtitle">Журнал за {monthLabel}</p>
        </div>
        <div className="inline-actions">
          <Button variant="secondary" onClick={() => setPeriodStart(shiftMonth(periodStart, -1))}>
            <FiChevronLeft />
            Предыдущий
          </Button>
          <Button variant="secondary" onClick={() => setPeriodStart(startOfMonth(new Date()))}>
            Этот месяц
          </Button>
          <Button variant="secondary" onClick={() => setPeriodStart(shiftMonth(periodStart, 1))}>
            Следующий
            <FiChevronRight />
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportCurrentPeriod}
            disabled={exportingMode === 'period'}
          >
            <FiDownload />
            {exportingMode === 'period' ? 'Выгружаю...' : 'Excel за период'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportAllTime}
            disabled={exportingMode === 'all'}
          >
            <FiDownload />
            {exportingMode === 'all' ? 'Выгружаю...' : 'Excel за всё время'}
          </Button>
        </div>
      </div>

      {exportError ? <div className="form-error">{exportError}</div> : null}

      {!journal.students.length ? (
        <div className="empty-state">
          <strong>В группе пока нет учеников</strong>
          <p>Сначала добавьте учеников, и журнал сразу станет полезным.</p>
        </div>
      ) : (
        <>
          <div className="journal-hint">
            <FiInfo />
            {canManage
              ? 'Нажмите на дату сверху, чтобы добавить тему урока. Нажмите на ячейку, чтобы поставить балл или Н.'
              : 'Здесь видны все отметки группы за выбранный месяц.'}
          </div>

          <div className="journal-table-scroll" ref={journalScrollRef}>
            <table className="journal-table journal-month-table">
              <thead>
                <tr>
                  <th className="journal-student-head" scope="col">
                    ФИО
                  </th>
                  {columns.map((column) => {
                    const isToday = isTodayColumn(column.date, periodStart)
                    const columnKey = `${column.date}:${column.lesson?.id ?? 'empty'}`

                    return (
                    <th
                      key={columnKey}
                      className={`journal-lesson-head journal-date-head ${isToday ? 'journal-col-today' : ''}`.trim()}
                      scope="col"
                      data-journal-date={column.date}
                      data-journal-date-today={isToday ? 'true' : undefined}
                    >
                      {canManage || column.lesson ? (
                        <button
                          type="button"
                          className={`journal-date-trigger ${column.lesson ? 'has-lesson' : ''}`.trim()}
                          onClick={() => handleOpenLessonDay(column)}
                          title={column.lesson?.topic || `Урок на ${column.date}`}
                        >
                          <span className="journal-date-weekday">{column.weekDayLabel}</span>
                          <span>{column.label}</span>
                          {column.lesson ? (
                            <span className="journal-date-markers">
                              <span className="journal-date-lesson-dot" aria-hidden="true" />
                              {column.lessonsCount > 1 ? (
                                <small>{column.lessonIndex}</small>
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        <div
                          className={`journal-date-trigger ${column.lesson ? 'has-lesson' : ''}`.trim()}
                          title={column.lesson?.topic || column.date}
                        >
                          <span className="journal-date-weekday">{column.weekDayLabel}</span>
                          <span>{column.label}</span>
                          {column.lesson ? (
                            <span className="journal-date-markers">
                              <span className="journal-date-lesson-dot" aria-hidden="true" />
                              {column.lessonsCount > 1 ? (
                                <small>{column.lessonIndex}</small>
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                <tr className="journal-topic-row">
                  <th className="journal-topic-label" scope="row">
                    Тема урока
                  </th>
                  {columns.map((column) => {
                    const isToday = isTodayColumn(column.date, periodStart)
                    const todayClass = isToday ? 'journal-col-today' : ''
                    const columnKey = `${column.date}:${column.lesson?.id ?? 'empty'}`

                    return (
                      <td key={columnKey} className={todayClass}>
                        {column.lesson ? (
                          <button
                            type="button"
                            className="journal-topic-cell has-topic"
                            title={column.lesson.topic}
                            onClick={() => handleOpenLessonDay(column)}
                          >
                            {formatTopicLabel(column.lesson.topic)}
                          </button>
                        ) : canManage ? (
                          <button
                            type="button"
                            className="journal-topic-add"
                            onClick={() => handleOpenLessonDay(column)}
                            title={`Добавить урок на ${column.date}`}
                          >
                            <FiPlus />
                          </button>
                        ) : (
                          <span className="journal-topic-cell" />
                        )}
                      </td>
                    )
                  })}
                </tr>

                {journal.students.map((student) => (
                  <tr key={student.id}>
                    <th className="journal-student-cell journal-student-cell-minimal" scope="row">
                      <span className="journal-student-name">{student.name}</span>
                    </th>

                    {columns.map((column) => {
                      const isToday = isTodayColumn(column.date, periodStart)
                      const todayClass = isToday ? 'journal-col-today' : ''
                      const columnKey = `${column.date}:${column.lesson?.id ?? 'empty'}`

                      if (!column.lesson) {
                        return (
                          <td key={columnKey} className={todayClass}>
                            {canManage ? (
                              <button
                                type="button"
                                className="journal-entry-cell journal-entry-empty"
                                onClick={() => handleOpenLessonDay(column)}
                                title={`Добавить урок на ${column.date}`}
                              >
                                <FiPlus />
                              </button>
                            ) : (
                              <div className="journal-entry-cell journal-entry-empty">{'\u00A0'}</div>
                            )}
                          </td>
                        )
                      }

                      const entry = entryLookup[`${student.id}:${column.lesson.id}`]
                      const label = getCellLabel(entry)
                      const tone = getCellTone(entry)
                      const cellClassName = ['journal-entry-cell', tone].join(' ').trim()

                      return (
                        <td key={columnKey} className={todayClass}>
                          {canManage ? (
                            <button
                              type="button"
                              className={cellClassName}
                              onClick={() => handleOpenEntry(student, column.lesson, entry)}
                            >
                              {label || <FiPlus />}
                            </button>
                          ) : (
                            <div className={cellClassName}>{label || '\u00A0'}</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="journal-footer">
            <div className="journal-legend" aria-label="Обозначения журнала">
              <span>
                <span className="legend-score">5</span>
                оценка
              </span>
              <span>
                <span className="legend-absent">Н</span>
                не был
              </span>
              <span>
                <span className="legend-topic-dot" />
                есть тема урока
              </span>
            </div>
            {canManage ? (
              <Button
                variant="secondary"
                className="journal-homework-action"
                onClick={() => {
                  if (homeworkLessonColumn) {
                    handleOpenLessonDay(homeworkLessonColumn)
                  }
                }}
                disabled={!homeworkLessonColumn}
              >
                <FiExternalLink />
                Добавить домашнее задание к выбранному уроку
              </Button>
            ) : null}
          </div>

          <section className="journal-summary" aria-label="Сводка по группе">
            <h4>Общая сводка</h4>
            <div className="summary-card-grid">
              <div className="summary-card">
                <span className="summary-icon summary-icon-teal">
                  <FiUsers />
                </span>
                <div>
                  <span>Всего учеников</span>
                  <strong>{groupSummary.studentsCount}</strong>
                </div>
              </div>
              <div className="summary-card">
                <span className="summary-icon summary-icon-green">
                  <FiStar />
                </span>
                <div>
                  <span>Сумма баллов</span>
                  <strong>{groupSummary.scoreTotal}</strong>
                </div>
              </div>
              <div className="summary-card">
                <span className="summary-icon summary-icon-violet">
                  <FiBarChart2 />
                </span>
                <div>
                  <span>Средний балл</span>
                  <strong>{formatAverage(groupSummary.averageScore)}</strong>
                </div>
              </div>
              <div className="summary-card">
                <span className="summary-icon summary-icon-red">
                  <FiCalendar />
                </span>
                <div>
                  <span>Всего пропусков</span>
                  <strong>{groupSummary.absentTotal}</strong>
                </div>
              </div>
            </div>

            <div className="summary-table-scroll">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th scope="col">ФИО</th>
                    <th scope="col">Кол-во отметок</th>
                    <th scope="col">Сумма баллов</th>
                    <th scope="col">Средний балл</th>
                    <th scope="col">Пропуски / Н</th>
                    <th scope="col">Последний балл</th>
                  </tr>
                </thead>
                <tbody>
                  {studentSummaries.map((student) => (
                    <tr key={student.id}>
                      <th scope="row">{student.name}</th>
                      <td>{student.scoreCount}</td>
                      <td>{student.scoreTotal}</td>
                      <td>{formatAverage(student.averageScore)}</td>
                      <td>{student.absentCount}</td>
                      <td>
                        {student.lastScore === null ? (
                          '—'
                        ) : (
                          <span className="summary-score-pill">{student.lastScore}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {canManage ? (
        <>
          <Modal
            open={deleteLessonModalOpen}
            title="Удалить урок"
            description=""
            onClose={() => {
              if (lessonDeleting) {
                return
              }

              setDeleteLessonModalOpen(false)
              setLessonToDelete(null)
              setLessonDeleteError('')
            }}
          >
            <form onSubmit={handleDeleteLesson}>
              <div className="danger-note">
                Урок и все его отметки будут удалены.
                <strong>{lessonToDelete?.topic ?? ''}</strong>
              </div>
              {lessonDeleteError ? <p className="input-error">{lessonDeleteError}</p> : null}
              <div className="modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDeleteLessonModalOpen(false)
                    setLessonToDelete(null)
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

          <Modal
            open={entryModalOpen}
            title={selectedStudent ? selectedStudent.name : 'Ячейка журнала'}
            description={selectedLesson ? selectedLesson.date : ''}
            onClose={() => {
              if (entrySaving) {
                return
              }

              setEntryModalOpen(false)
              setSelectedStudent(null)
              setSelectedLesson(null)
              setEntryError('')
            }}
          >
            <form onSubmit={handleSaveEntry}>
              <div className="entry-status-group" role="radiogroup" aria-label="Отметка журнала">
                <button
                  type="button"
                  className={`entry-status-button ${entryMode === 'grade' ? 'active' : ''}`}
                  onClick={() => {
                    setEntryMode('grade')
                    if (entryError) {
                      setEntryError('')
                    }
                  }}
                >
                  Баллы
                </button>
                <button
                  type="button"
                  className={`entry-status-button entry-status-absent ${entryMode === 'absent' ? 'active' : ''}`}
                  onClick={() => {
                    setEntryMode('absent')
                    setEntryGrade('')
                    if (entryError) {
                      setEntryError('')
                    }
                  }}
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
                disabled={entryMode === 'absent'}
                placeholder={entryMode === 'absent' ? 'Недоступно' : `1 - ${MAX_SCORE}`}
              />

              <div className="modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEntryModalOpen(false)
                    setSelectedStudent(null)
                    setSelectedLesson(null)
                    setEntryError('')
                  }}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={entrySaving}>
                  {entrySaving ? 'Сохраняю...' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      ) : null}

      <Modal
        open={lessonModalOpen}
        title={editingLesson ? 'Тема урока' : 'Новый урок'}
        description={selectedDate}
        onClose={() => {
          if (lessonSaving) {
            return
          }

          setLessonModalOpen(false)
          setSelectedDate('')
          setEditingLesson(null)
          setLessonTopic('')
          setLessonHomework('')
          setLessonError('')
        }}
      >
        <form onSubmit={handleSaveLesson}>
          <Input
            label="Тема урока"
            value={lessonTopic}
            onChange={(event) => {
              setLessonTopic(event.target.value)
              if (lessonError) {
                setLessonError('')
              }
            }}
            error={lessonError}
            readOnly={!canManage}
          />
          <Input
            label="Домашнее задание"
            as="textarea"
            value={lessonHomework}
            onChange={(event) => setLessonHomework(event.target.value)}
            readOnly={!canManage}
            placeholder={canManage ? 'Например, повторить аяты 1-5' : ''}
          />

          <div className="modal-actions">
            {editingLesson ? (
              <Link className="button button-secondary" to={`/lesson/${editingLesson.id}`}>
                <FiExternalLink />
                Открыть урок
              </Link>
            ) : null}
            {canManage && editingLesson ? (
              <>
                <Button variant="secondary" onClick={handleAddAnotherLesson}>
                  Добавить ещё
                </Button>
                <Button variant="danger" onClick={openDeleteLessonModal}>
                  <FiTrash2 />
                  Удалить
                </Button>
              </>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                setLessonModalOpen(false)
                setSelectedDate('')
                setEditingLesson(null)
                setLessonTopic('')
                setLessonHomework('')
                setLessonError('')
              }}
            >
              {canManage ? 'Отмена' : 'Закрыть'}
            </Button>
            {canManage ? (
              <Button type="submit" disabled={lessonSaving}>
                {lessonSaving ? 'Сохраняю...' : 'Сохранить'}
              </Button>
            ) : null}
          </div>
        </form>
      </Modal>
    </section>
  )
}

export default GroupJournalPanel
