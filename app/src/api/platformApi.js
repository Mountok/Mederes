import api from './client.js'

export async function listPlatformSchools() {
  const { data } = await api.get('/platform/schools')
  return data.schools
}

export async function listPlatformInquiries() {
  const { data } = await api.get('/platform/inquiries')
  return data.inquiries
}

export async function getPlatformSchool(id) {
  const { data } = await api.get(`/platform/schools/${id}`)
  return data
}

export async function createPlatformSchool(input) {
  const { data } = await api.post('/platform/schools', input)
  return data
}

export async function renamePlatformSchool(id, name) {
  const { data } = await api.patch(`/platform/schools/${id}`, { name })
  return data.school
}

export async function resetPlatformAccess(schoolId, userId) {
  const { data } = await api.post(`/platform/schools/${schoolId}/users/${userId}/access/reset`)
  return data.account
}

export async function listPlatformReaders(query, offset, signal) {
  const { data } = await api.get('/platform/readers', { params: { q: query, offset }, signal })
  return data
}

export async function resetReaderTrial(readerId) {
  const { data } = await api.post(`/platform/readers/${readerId}/trial/reset`)
  return data.reader
}

export async function setReaderSubscription(readerId, months, expectedUntil) {
  const { data } = await api.put(`/platform/readers/${readerId}/subscription`, { months, expectedUntil })
  return data.reader
}
