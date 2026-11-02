import api from './client.js'

export async function listPlatformSchools() {
  const { data } = await api.get('/platform/schools')
  return data.schools
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
