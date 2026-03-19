export interface StemExportResult {
  stems: {
    drum:    Blob | null
    bass:    Blob | null
    melody:  Blob | null
    texture: Blob | null
    master:  Blob | null
  }
  sessionId: string
}

export class AudioExporter {
  private recorders:  Map<string, MediaRecorder>  = new Map()
  private chunks:     Map<string, Blob[]>          = new Map()
  private recording:  boolean = false

  start(sourceNodes: Record<string, MediaStreamAudioDestinationNode>): void {
    if (this.recording) return

    this.recorders.clear()
    this.chunks.clear()

    for (const [name, node] of Object.entries(sourceNodes)) {
      const stream   = node.stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const stemChunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) stemChunks.push(e.data)
      }

      this.recorders.set(name, recorder)
      this.chunks.set(name, stemChunks)
      recorder.start(100)
    }

    this.recording = true
  }

  async stop(sessionId: string): Promise<StemExportResult> {
    if (!this.recording) {
      return { stems: { drum: null, bass: null, melody: null, texture: null, master: null }, sessionId }
    }

    await Promise.all(
      Array.from(this.recorders.entries()).map(([, recorder]) =>
        new Promise<void>(resolve => {
          recorder.onstop = () => resolve()
          recorder.stop()
        })
      )
    )

    this.recording = false

    const makeBlob = (name: string): Blob | null => {
      const parts = this.chunks.get(name)
      return parts && parts.length > 0
        ? new Blob(parts, { type: 'audio/webm' })
        : null
    }

    return {
      stems: {
        drum:    makeBlob('drum'),
        bass:    makeBlob('bass'),
        melody:  makeBlob('melody'),
        texture: makeBlob('texture'),
        master:  makeBlob('master'),
      },
      sessionId,
    }
  }

  isRecording(): boolean { return this.recording }
}
