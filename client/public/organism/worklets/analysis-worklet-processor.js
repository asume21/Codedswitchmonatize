class AnalysisWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._frameIndex = 0
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0]
    if (!input || !input[0]) {
      return true
    }

    const channelData = input[0]
    const buffer = new Float32Array(channelData)

    this.port.postMessage(
      {
        type: 'frame',
        frameIndex: this._frameIndex,
        buffer,
      },
      [buffer.buffer],
    )

    this._frameIndex += 1
    return true
  }
}

registerProcessor('analysis-worklet-processor', AnalysisWorkletProcessor)
