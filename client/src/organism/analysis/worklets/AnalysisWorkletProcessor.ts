declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void

class AnalysisWorkletProcessor extends AudioWorkletProcessor {
  private frameIndex = 0

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const input = inputs[0]
    if (!input || !input[0]) {
      return true
    }

    const channelData = input[0]
    const buffer = new Float32Array(channelData)

    this.port.postMessage(
      {
        type: 'frame',
        frameIndex: this.frameIndex,
        buffer,
      },
      [buffer.buffer],
    )

    this.frameIndex += 1
    return true
  }
}

registerProcessor('analysis-worklet-processor', AnalysisWorkletProcessor)
