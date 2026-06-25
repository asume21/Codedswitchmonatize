export interface LoopClip {
  id:      string
  url:     string
  bars:    number
  label?:  string
}

export interface LoopPack {
  id:     string
  genre:  string
  bpm:    number
  key:    string
  label:  string
  loops: {
    drums:   LoopClip[]
    bass:    LoopClip[]
    melody:  LoopClip[]
    chords:  LoopClip[]
    texture: LoopClip[]
  }
}
