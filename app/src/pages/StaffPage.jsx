import { useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiKey, FiPlus, FiTrash2, FiUserPlus } from 'react-icons/fi'
import { Navigate } from 'react-router-dom'
import { getGroups } from '../api/mockApi.js'
import {
  createStaff,
  deleteStaff,
  getStaffList,
  resetStaffAccess,
  updateStaff,
  updateStaffGroups,
} from '../api/staffApi.js'
import { useAuth } from '../auth/useAuth.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Modal from '../components/Modal.jsx'
import StatusState from '../components/StatusState.jsx'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  middleName: '',
  phone: '',
  note: '',
  groupIds: [],
}

function getFullName(staff) {
  return [staff.lastName, staff.firstName, staff.middleName].filter(Boolean).join(' ')
}

function StaffPage() {
  const { isTeacher } = useAuth()
  const [staff, setStaff] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [account, setAccount] = useState(null)
  const [staffToDelete, setStaffToDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const selectedGroupSet = useMemo(() => new Set(form.groupIds), [form.groupIds])

  useEffect(() => {
    if (!isTeacher) {
      return
    }

    loadPage()
  }, [isTeacher])

  if (!isTeacher) {
    return <Navigate to="/forbidden" replace />
  }

  async function loadPage(showLoading = true) {
    if (showLoading) {
      setLoading(true)
    }
    setLoadError('')

    try {
      const [nextStaff, nextGroups] = await Promise.all([getStaffList(), getGroups()])
      setStaff(nextStaff)
      setGroups(nextGroups)
    } catch {
      setLoadError('Не удалось загрузить преподавателей')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    if (formError) {
      setFormError('')
    }
  }

  function toggleGroup(groupId) {
    setForm((currentForm) => {
      const nextSet = new Set(currentForm.groupIds)
      if (nextSet.has(groupId)) {
        nextSet.delete(groupId)
      } else {
        nextSet.add(groupId)
      }

      return {
        ...currentForm,
        groupIds: Array.from(nextSet),
      }
    })
  }

  function openCreateModal() {
    setEditingStaff(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(staffItem) {
    setEditingStaff(staffItem)
    setForm({
      firstName: staffItem.firstName,
      lastName: staffItem.lastName,
      middleName: staffItem.middleName,
      phone: staffItem.phone,
      note: staffItem.note,
      groupIds: staffItem.groups.map((group) => group.id),
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Введите имя и фамилию преподавателя')
      return
    }

    setSaving(true)
    setFormError('')

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName.trim(),
      phone: form.phone.trim(),
      note: form.note.trim(),
      groupIds: form.groupIds,
    }

    try {
      if (editingStaff) {
        const updatedStaff = await updateStaff(editingStaff.id, payload)
        await updateStaffGroups(editingStaff.id, payload.groupIds)
        setStaff((currentStaff) =>
          currentStaff.map((staffItem) =>
            staffItem.id === editingStaff.id
              ? {
                  ...updatedStaff,
                  groups: groups.filter((group) => payload.groupIds.includes(group.id)),
                }
              : staffItem,
          ),
        )
      } else {
        const response = await createStaff(payload)
        setAccount({
          staffName: getFullName(response.staff),
          ...response.account,
        })
        setStaff((currentStaff) => [...currentStaff, response.staff])
      }

      setModalOpen(false)
      setEditingStaff(null)
      setForm(EMPTY_FORM)
      await loadPage(false)
    } catch (error) {
      setFormError(error?.response?.data?.error?.message ?? 'Не удалось сохранить преподавателя')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetAccess(staffItem) {
    const response = await resetStaffAccess(staffItem.id)
    setAccount({
      staffName: getFullName(staffItem),
      ...response.account,
    })
  }

  async function handleDeleteStaff(event) {
    event.preventDefault()

    if (!staffToDelete) {
      return
    }

    setDeleting(true)
    setDeleteError('')

    try {
      await deleteStaff(staffToDelete.id)
      setStaff((currentStaff) =>
        currentStaff.filter((staffItem) => staffItem.id !== staffToDelete.id),
      )
      setStaffToDelete(null)
    } catch (error) {
      setDeleteError(error?.response?.data?.error?.message ?? 'Не удалось удалить преподавателя')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-grid">
        <StatusState title="Загрузка" description="Загружаю преподавателей..." />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-grid">
        <StatusState
          title="Не удалось загрузить"
          description={loadError}
          actionLabel="Повторить"
          actionOnClick={() => loadPage()}
        />
      </div>
    )
  }

  return (
    <div className="page-grid">
      <section className="page-header pulse-in">
        <div className="page-header-main">
          <h2>Преподаватели</h2>
          <p>{staff.length} сотрудников, которых можно привязать к группам</p>
        </div>
        <div className="page-header-actions">
          <Button onClick={openCreateModal}>
            <FiUserPlus />
            Создать преподавателя
          </Button>
        </div>
      </section>

      <section className="surface">
        {staff.length ? (
          <div className="staff-grid">
            {staff.map((staffItem) => (
              <article key={staffItem.id} className="staff-card">
                <div className="staff-card-head">
                  <div>
                    <h3>{getFullName(staffItem)}</h3>
                    {staffItem.phone ? <p>{staffItem.phone}</p> : null}
                  </div>
                  <span>{staffItem.groups.length} групп</span>
                </div>

                {staffItem.note ? <p className="staff-note">{staffItem.note}</p> : null}

                <div className="staff-groups">
                  {staffItem.groups.length ? (
                    staffItem.groups.map((group) => <span key={group.id}>{group.name}</span>)
                  ) : (
                    <span>Группы не назначены</span>
                  )}
                </div>

                <div className="inline-actions">
                  <Button variant="secondary" onClick={() => openEditModal(staffItem)}>
                    <FiEdit2 />
                    Изменить
                  </Button>
                  <Button variant="secondary" onClick={() => handleResetAccess(staffItem)}>
                    <FiKey />
                    Доступ
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDeleteError('')
                      setStaffToDelete(staffItem)
                    }}
                  >
                    <FiTrash2 />
                    Удалить
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Преподавателей пока нет</strong>
            <p>Создайте сотрудника и назначьте ему одну или несколько групп.</p>
            <div className="modal-actions">
              <Button onClick={openCreateModal}>
                <FiPlus />
                Создать первого
              </Button>
            </div>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editingStaff ? 'Изменить преподавателя' : 'Новый преподаватель'}
        description=""
        onClose={() => {
          if (saving) {
            return
          }
          setModalOpen(false)
          setEditingStaff(null)
          setForm(EMPTY_FORM)
        }}
      >
        <form className="staff-form" onSubmit={handleSubmit}>
          <div className="staff-form-grid">
            <Input
              label="Имя"
              value={form.firstName}
              onChange={(event) => updateField('firstName', event.target.value)}
            />
            <Input
              label="Фамилия"
              value={form.lastName}
              onChange={(event) => updateField('lastName', event.target.value)}
            />
            <Input
              label="Отчество"
              value={form.middleName}
              onChange={(event) => updateField('middleName', event.target.value)}
            />
            <Input
              label="Телефон"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </div>

          <Input
            label="Заметка"
            as="textarea"
            value={form.note}
            onChange={(event) => updateField('note', event.target.value)}
          />

          <div className="input-stack">
            <span className="label">Группы</span>
            <div className="staff-group-picker">
              {groups.map((group) => (
                <label key={group.id} className="staff-group-option">
                  <input
                    type="checkbox"
                    checked={selectedGroupSet.has(group.id)}
                    onChange={() => toggleGroup(group.id)}
                  />
                  <span>{group.name}</span>
                </label>
              ))}
            </div>
          </div>

          {formError ? <p className="input-error">{formError}</p> : null}

          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(false)
                setEditingStaff(null)
                setForm(EMPTY_FORM)
              }}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(account)}
        title="Доступ преподавателя"
        description="Пароль показывается только сейчас. Передайте эти данные преподавателю."
        onClose={() => setAccount(null)}
      >
        <div className="input-stack">
          <Input label="Преподаватель" value={account?.staffName ?? ''} readOnly />
          <Input label="Логин" value={account?.login ?? ''} readOnly />
          <Input label="Пароль" value={account?.password ?? ''} readOnly />
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setAccount(null)}>
            Закрыть
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(staffToDelete)}
        title="Удалить преподавателя"
        description=""
        onClose={() => {
          if (deleting) {
            return
          }
          setStaffToDelete(null)
          setDeleteError('')
        }}
      >
        <form onSubmit={handleDeleteStaff}>
          <div className="danger-note">
            Аккаунт преподавателя будет удалён. Группы, ученики и уроки останутся.
            <strong>{staffToDelete ? getFullName(staffToDelete) : ''}</strong>
          </div>
          {deleteError ? <p className="input-error">{deleteError}</p> : null}
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setStaffToDelete(null)
                setDeleteError('')
              }}
              disabled={deleting}
            >
              Отмена
            </Button>
            <Button type="submit" variant="danger" disabled={deleting}>
              <FiTrash2 />
              {deleting ? 'Удаление...' : 'Удалить'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default StaffPage
