/* global AudioWorkletProcessor, registerProcessor */
class RecitationCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(4096)
    this.offset = 0
    this.port.onmessage = ({ data }) => {
      if (data === 'flush') { this.flush(); this.port.postMessage({ type: 'flushed' }) }
    }
  }
  flush() {
    if (!this.offset) return
    const samples = this.buffer.slice(0, this.offset)
    this.port.postMessage({ type: 'samples', samples }, [samples.buffer])
    this.offset = 0
  }
  process(inputs) {
    const input = inputs[0]?.[0]
    if (input) for (const sample of input) {
      this.buffer[this.offset++] = sample
      if (this.offset === this.buffer.length) this.flush()
    }
    return true
  }
}
registerProcessor('recitation-capture', RecitationCapture)
