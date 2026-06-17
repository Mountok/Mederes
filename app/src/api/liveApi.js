import axios from 'axios'
import api from './client.js'

const publicApi = axios.create({
  baseURL: '/api',
})

export async function createLiveRoom(payload) {
  const { data } = await api.post('/live/rooms', payload)
  return data
}

export async function joinLiveRoom(payload) {
  const { data } = await publicApi.post('/live/rooms/join', payload)
  return data
}

export async function getLiveRoom(roomId) {
  const { data } = await api.get(`/live/rooms/${roomId}`)
  return data
}

export async function getLiveToken(roomId, participantId) {
  const client = participantId ? publicApi : api
  const { data } = await client.post(`/live/rooms/${roomId}/token`, {
    participant_id: participantId ?? '',
  })
  return data
}

export async function endLiveRoom(roomId) {
  const { data } = await api.post(`/live/rooms/${roomId}/end`)
  return data
}

export async function getLiveMessages(roomId, participantId) {
  const params = participantId ? { participant_id: participantId, limit: 80 } : { limit: 80 }
  const { data } = await publicApi.get(`/live/rooms/${roomId}/messages`, { params })
  return data.messages ?? []
}

export async function sendLiveMessage(roomId, participantId, message) {
  const { data } = await publicApi.post(`/live/rooms/${roomId}/messages`, {
    participant_id: participantId,
    message,
  })
  return data
}

export function buildLiveWebSocketURL(roomId, participantId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams()

  if (participantId) {
    params.set('participant_id', participantId)
  }

  return `${protocol}//${window.location.host}/api/live/rooms/${roomId}/ws?${params.toString()}`
}
