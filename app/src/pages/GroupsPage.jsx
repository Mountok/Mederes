import { useEffect, useState } from 'react'
import { FiFolderPlus, FiPlus } from 'react-icons/fi'
import { createGroup, getGroups } from '../api/mockApi.js'
import { useAuth } from '../auth/useAuth.jsx'
import Button from '../components/Button.jsx'
import GroupCard from '../components/GroupCard.jsx'
import Input from '../components/Input.jsx'
import Modal from '../components/Modal.jsx'
import StatusState from '../components/StatusState.jsx'
import StudentHomePage from './StudentHomePage.jsx'

function GroupsContent({ isTeacher }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadGroups()
  }, [])

  async function loadGroups() {
    setLoading(true)
    setLoadError('')

    try {
      const response = await getGroups()
      setGroups(response)
    } catch {
      setLoadError('Не удалось загрузить группы')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!name.trim()) {
      setFormError('Введите название группы')
      return
    }

    setFormError('')

    await createGroup({
      name: name.trim(),
      description: description.trim(),
    })

    setName('')
    setDescription('')
    setIsModalOpen(false)
    await loadGroups()
  }

  const studentTotal = groups.reduce((sum, group) => sum + group.studentCount, 0)
  const lessonTotal = groups.reduce((sum, group) => sum + group.lessonCount, 0)

  return (
    <div className="page-grid">
      <section className="page-header groups-page-header pulse-in">
        <div className="page-header-main">
          <h2>Группы</h2>
          <p>{groups.length} групп, {studentTotal} учеников, {lessonTotal} уроков</p>
        </div>
        <div className="page-header-actions">
          {isTeacher ? (
            <Button onClick={() => setIsModalOpen(true)}>
              <FiPlus />
              Создать группу
            </Button>
          ) : null}
        </div>
      </section>

      <section className="surface">
        <div className="section-header">
          <h3>Группы</h3>
          <div className="header-actions">
            {isTeacher ? (
              <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                <FiFolderPlus />
                Новая группа
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <StatusState title="Загрузка" description="Загружаю группы..." />
        ) : loadError ? (
          <StatusState
            title="Не удалось загрузить"
            description={loadError}
            actionLabel="Повторить"
            actionOnClick={loadGroups}
          />
        ) : groups.length ? (
          <div className="group-grid">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Группы пока не созданы</strong>
            <p>
              {isTeacher
                ? 'Создайте первую группу для этой школы.'
                : 'Для вашей школы пока ещё не добавили ни одной группы.'}
            </p>
            {isTeacher ? (
              <div className="modal-actions">
                <Button onClick={() => setIsModalOpen(true)}>
                  <FiPlus />
                  Создать первую группу
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {isTeacher ? (
        <Modal
          open={isModalOpen}
          title="Создать группу"
          description=""
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={handleSubmit}>
            <Input
              label="Название группы"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (formError) {
                  setFormError('')
                }
              }}
              placeholder="Например, Хифз"
              error={formError}
            />
            <Input
              label="Описание"
              as="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Короткое описание"
            />
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

function GroupsPage() {
  const { isTeacher, isStudent } = useAuth()

  if (isStudent) {
    return <StudentHomePage />
  }

  return <GroupsContent isTeacher={isTeacher} />
}

export default GroupsPage
