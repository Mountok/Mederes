export function wavBlob(chunks, sampleRate) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const view = new DataView(new ArrayBuffer(44 + length * 2))
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, length * 2, true)
  let offset = 44
  for (const chunk of chunks) for (const raw of chunk) {
    const sample = Math.max(-1, Math.min(1, raw))
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true)
    offset += 2
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}

export function wavWindowBlob(chunks, sampleRate, seconds) {
  let remaining = Math.round(sampleRate * seconds)
  const tail = []
  for (let index = chunks.length - 1; index >= 0 && remaining > 0; index--) {
    const chunk = chunks[index]
    const count = Math.min(chunk.length, remaining)
    tail.unshift(chunk.subarray(chunk.length - count))
    remaining -= count
  }
  return wavBlob(tail, sampleRate)
}

export function pcm16Buffer(samples) {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(index * 2, sample < 0 ? sample * 32768 : sample * 32767, true)
  }
  return buffer
}

// One request at a time; replace stale intermediate snapshots with the newest.
export function latestQueue(worker) {
  let active = false, pending = null, closed = false
  async function pump() {
    if (active || closed) return
    active = true
    try {
      while (pending && !closed) {
        const value = pending
        pending = null
        await worker(value)
      }
    } finally { active = false }
  }
  return {
    push(value) { if (!closed) { pending = value; void pump() } },
    close() { closed = true; pending = null },
  }
}
