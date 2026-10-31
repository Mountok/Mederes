import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { setImmediate as tick } from 'node:timers/promises'
import { wavBlob, wavWindowBlob, latestQueue, pcm16Buffer } from '../src/audio/pcm.js'
import { combineResults, keepAlignedProvisional } from '../src/audio/liveTracking.js'

test('PCM encoder produces mono PCM16 WAV with bounded samples', async () => {
  const blob = wavBlob([new Float32Array([-2, 0, 2]), new Float32Array([.5])], 48000)
  const data = new DataView(await blob.arrayBuffer())
  assert.equal(blob.size, 52)
  assert.equal(data.getUint32(24, true), 48000)
  assert.equal(data.getUint32(40, true), 8)
  assert.equal(data.getInt16(44, true), -32768)
  assert.equal(data.getInt16(48, true), 32767)
})

test('WebSocket microphone frames contain little-endian PCM16', () => {
  const view = new DataView(pcm16Buffer(new Float32Array([-2, 0, .5, 2])))
  assert.deepEqual([0, 2, 4, 6].map(offset => view.getInt16(offset, true)),
    [-32768, 0, Math.trunc(.5 * 32767), 32767])
})

test('live window contains only the latest samples', async () => {
  const blob = wavWindowBlob([new Float32Array([.1, .2]), new Float32Array([.3, .4])], 2, 1)
  const data = new DataView(await blob.arrayBuffer())
  assert.equal(data.getUint32(40, true), 4)
  assert.equal(data.getInt16(44, true), Math.round(.3 * 32767))
})

test('confirmation replaces preliminary words without removing newer progress', () => {
  const word = state => ({ state })
  const preview = { tracking: { words: [word('matched'), word('tentative'), word('matched')], reached: 3, aligned: true } }
  const confirmed = { model: 'base', tracking: { words: [word('review'), word('matched'), word('pending')], reached: 2, aligned: true } }
  const result = combineResults(preview, confirmed)
  assert.deepEqual(result.tracking.words.map(item => item.state), ['review', 'matched', 'matched'])
  assert.equal(result.tracking.reached, 3)
  assert.equal(result.confirmed_model, 'base')
})

test('weak final result keeps aligned provisional highlighting clearly marked', () => {
  const pending = { state: 'pending' }
  const matched = { state: 'matched' }
  const final = { tracking: { aligned: false, words: [pending], final: true } }
  const confirmed = { tracking: { aligned: true, words: [matched], final: false } }
  const result = keepAlignedProvisional(final, null, confirmed)
  assert.equal(result.tracking.words[0].state, 'matched')
  assert.equal(result.final_fallback, true)
  assert.equal(result.tracking.final, false)
})

test('sparse tentative words from base extend the preview without claiming a match', () => {
  const pending = { state: 'pending' }
  const tentative = { state: 'tentative' }
  const preview = { tracking: { words: [tentative, pending], aligned: false, low_confidence: true, reached: 1 } }
  const confirmed = { tracking: { words: [pending, tentative], aligned: false, low_confidence: true, reached: 2 } }
  const result = combineResults(preview, confirmed)
  assert.deepEqual(result.tracking.words.map(word => word.state), ['tentative', 'tentative'])
  assert.equal(result.tracking.low_confidence, true)
  assert.equal(result.tracking.matched, 0)
})

test('queue keeps only the newest snapshot and preserves the final request', async () => {
  const calls = []
  let release
  const queue = latestQueue(async item => {
    calls.push(item)
    if (item === 'first') await new Promise(resolve => { release = resolve })
  })
  queue.push('first'); queue.push('obsolete'); queue.push('final')
  assert.deepEqual(calls, ['first'])
  release(); await tick()
  assert.deepEqual(calls, ['first', 'final'])
})

test('closed queue drops pending work', async () => {
  const calls = []
  let release
  const queue = latestQueue(async item => { calls.push(item); await new Promise(resolve => { release = resolve }) })
  queue.push('first'); queue.push('pending'); queue.close(); release(); await tick()
  queue.push('later')
  assert.deepEqual(calls, ['first'])
})

test('audio worklet flushes the final partial buffer', () => {
  let Processor
  const messages = []
  runInNewContext(readFileSync(new URL('../public/recitation-capture.js', import.meta.url), 'utf8'), {
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: value => messages.push(value) } } },
    registerProcessor: (_name, implementation) => { Processor = implementation },
    Float32Array,
  })
  const processor = new Processor()
  processor.process([[new Float32Array(128).fill(.25)]])
  assert.equal(messages.length, 0)
  processor.port.onmessage({ data: 'flush' })
  assert.equal(messages[0].samples.length, 128)
  assert.equal(messages[0].samples[0], .25)
  assert.equal(messages[1].type, 'flushed')
})
