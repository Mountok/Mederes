import api from './client.js'

export async function getStaffList() {
  const { data } = await api.get('/staff')
  return data
}

export async function createStaff(payload) {
  const { data } = await api.post('/staff', payload)
  return data
}

export async function updateStaff(staffId, payload) {
  const { data } = await api.put(`/staff/${staffId}`, payload)
  return data
}

export async function updateStaffGroups(staffId, groupIds) {
  const { data } = await api.put(`/staff/${staffId}/groups`, { groupIds })
  return data
}

export async function resetStaffAccess(staffId) {
  const { data } = await api.post(`/staff/${staffId}/access/reset`)
  return data
}

export async function deleteStaff(staffId) {
  const { data } = await api.delete(`/staff/${staffId}`)
  return data
}
