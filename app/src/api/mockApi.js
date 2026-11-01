import api from './client.js'

export async function getGroups() {
  const { data } = await api.get('/groups')
  return data
}

export async function createGroup(payload) {
  const { data } = await api.post('/groups', payload)
  return data
}

export async function deleteGroup(groupId) {
  const { data } = await api.delete(`/groups/${groupId}`)
  return data
}

export async function getGroupById(groupId) {
  const { data } = await api.get(`/groups/${groupId}`)
  return data
}

export async function getGroupJournal(groupId, params = {}) {
  const { data } = await api.get(`/groups/${groupId}/journal`, { params })
  return data
}

export async function createStudent(payload) {
  const { data } = await api.post('/students', payload)
  return data
}

export async function updateStudent(studentId, payload) {
  const { data } = await api.put(`/students/${studentId}`, payload)
  return data
}

export async function deleteStudent(studentId) {
  const { data } = await api.delete(`/students/${studentId}`)
  return data
}

export async function resetStudentAccess(studentId) {
  const { data } = await api.post(`/students/${studentId}/access/reset`)
  return data
}

export async function createLesson(payload) {
  const { data } = await api.post('/lessons', payload)
  return data
}

export async function getLessonById(lessonId) {
  const { data } = await api.get(`/lessons/${lessonId}`)
  return data
}

export async function updateLesson(lessonId, payload) {
  const { data } = await api.put(`/lessons/${lessonId}`, payload)
  return data
}

export async function deleteLesson(lessonId) {
  const { data } = await api.delete(`/lessons/${lessonId}`)
  return data
}

export async function updateAttendance(payload) {
  const { data } = await api.put('/attendance', payload)
  return data
}

export async function setAttendanceForAll(lessonId, attended) {
  const { data } = await api.put(`/lessons/${lessonId}/attendance/all`, {
    attended,
  })
  return data
}

export async function getHomework() {
  const { data } = await api.get('/homework')
  return data
}

export async function getHomeworkById(id) {
  const { data } = await api.get(`/homework/${id}`)
  return data
}

export async function createHomework(payload) {
  const { data } = await api.post('/homework', payload)
  return data
}

export async function completeHomework(id) {
  const { data } = await api.post(`/homework/${id}/complete`)
  return data
}

export async function submitHomework(id, audio) {
  const form = new FormData()
  form.append('audio', audio, audio.name || 'reading.wav')
  const { data } = await api.post(`/homework/${id}/submit`, form, { timeout: 90000 })
  return data
}

export async function reviewHomework(id, studentId, payload) {
  const { data } = await api.put(`/homework/${id}/submissions/${studentId}/review`, payload)
  return data
}

export async function getHomeworkAudio(id, studentId) {
  const { data } = await api.get(`/homework/${id}/audio/${studentId}`, { responseType: 'blob' })
  return data
}
