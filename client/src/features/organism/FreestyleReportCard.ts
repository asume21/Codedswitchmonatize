/**
 * FREESTYLE REPORT CARD
 *
 * Collects and computes session statistics from a freestyle session:
 *  - Total duration
 *  - Words spoken, syllables, lines/bars
 *  - Flow metrics: words per minute, syllables per beat, cadence consistency
 *  - Beat interaction: drops triggered, vibe changes, command count
 *  - Vocabulary: unique words, lexical diversity
 *  - Timing: average bar length, longest bar streak, silence ratio
 *  - Overall grade (A-F)
 *
 * Usage:
 *   const card = new FreestyleReportCard()
 *   card.startSession(bpm)
 *   // ... feed data throughout session ...
 *   card.addLine("I'm spitting fire on the mic tonight", startMs, endMs)
 *   card.addDrop(intensity)
 *   card.addVibeChange("Trap", "Lo-fi")
 *   card.addVoiceCommand("faster")
 *   const report = card.endSession()
 */

export interface FreestyleReport {
  // Session info
  sessionId:        string
  startTime:        number
  endTime:          number
  durationMs:       number
  bpm:              number

  // Flow metrics
  totalWords:       number
  totalSyllables:   number
  totalLines:       number
  wordsPerMinute:   number
  syllablesPerBeat: number
  averageBarLengthMs: number
  longestBarStreak: number       // consecutive bars without pause
  silenceRatio:     number       // 0-1, fraction of time spent silent

  // Vocabulary
  uniqueWords:      number
  lexicalDiversity: number       // unique/total ratio (0-1)
  topWords:         Array<{ word: string; count: number }>

  // Beat interaction
  dropsTriggered:   number
  vibeChanges:      number
  voiceCommands:    number
  genresVisited:    string[]

  // Cadence
  cadenceConsistency: number     // 0-1, how steady the flow was
  averageSyllableRate: number    // syllables per second

  // Grade
  overallScore:     number       // 0-100
  grade:            string       // A+, A, B+, B, C+, C, D, F
  strengths:        string[]
  improvements:     string[]
}

interface LineData {
  text:       string
  startMs:    number
  endMs:      number
  syllables:  number
  words:      number
}

function countSyllables(text: string): number {
  const cleaned = text.toLowerCase().replace(/[^a-z\s]/g, '').trim()
  if (!cleaned) return 0

  const words = cleaned.split(/\s+/)
  let total = 0

  for (const w of words) {
    if (w.length <= 2) { total += 1; continue }
    const vowelGroups = w.match(/[aeiouy]+/g)
    let count = vowelGroups ? vowelGroups.length : 1
    if (w.endsWith('e') && count > 1) count--
    total += Math.max(1, count)
  }

  return total
}

function generateSessionId(): string {
  return `fs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class FreestyleReportCard {
  private sessionId:      string = ''
  private startTime:      number = 0
  private bpm:            number = 0
  private lines:          LineData[] = []
  private drops:          number[] = []          // intensities
  private vibeChanges:    Array<{ from: string; to: string }> = []
  private voiceCommands:  string[] = []
  private genresVisited:  Set<string> = new Set()
  private isActive:       boolean = false

  /** Start a new freestyle session. */
  startSession(bpm: number): void {
    this.sessionId = generateSessionId()
    this.startTime = performance.now()
    this.bpm = bpm
    this.lines = []
    this.drops = []
    this.vibeChanges = []
    this.voiceCommands = []
    this.genresVisited = new Set()
    this.isActive = true
  }

  /** Add a transcribed line/bar. */
  addLine(text: string, startMs: number, endMs: number): void {
    if (!this.isActive) return
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length
    const syllables = countSyllables(text)
    this.lines.push({ text, startMs, endMs, syllables, words })
  }

  /** Record a beat drop. */
  addDrop(intensity: number): void {
    if (!this.isActive) return
    this.drops.push(intensity)
  }

  /** Record a vibe/genre change. */
  addVibeChange(from: string, to: string): void {
    if (!this.isActive) return
    this.vibeChanges.push({ from, to })
    this.genresVisited.add(from)
    this.genresVisited.add(to)
  }

  /** Record a voice command. */
  addVoiceCommand(command: string): void {
    if (!this.isActive) return
    this.voiceCommands.push(command)
  }

  /** Update the BPM (if it changed during the session). */
  updateBpm(bpm: number): void {
    this.bpm = bpm
  }

  /** End the session and compute the full report. */
  endSession(): FreestyleReport {
    this.isActive = false
    const endTime = performance.now()
    const durationMs = endTime - this.startTime

    // Basic counts
    const totalWords = this.lines.reduce((sum, l) => sum + l.words, 0)
    const totalSyllables = this.lines.reduce((sum, l) => sum + l.syllables, 0)
    const totalLines = this.lines.length

    // Words per minute
    const durationMin = durationMs / 60000
    const wordsPerMinute = durationMin > 0 ? Math.round(totalWords / durationMin) : 0

    // Syllables per beat
    const beatsInSession = (durationMs / 60000) * this.bpm
    const syllablesPerBeat = beatsInSession > 0
      ? Math.round((totalSyllables / beatsInSession) * 100) / 100
      : 0

    // Average bar length
    const barLengths = this.lines.map(l => l.endMs - l.startMs)
    const averageBarLengthMs = barLengths.length > 0
      ? Math.round(barLengths.reduce((a, b) => a + b, 0) / barLengths.length)
      : 0

    // Longest bar streak (consecutive bars without > 2s gap)
    let currentStreak = 1
    let longestBarStreak = totalLines > 0 ? 1 : 0
    for (let i = 1; i < this.lines.length; i++) {
      const gap = this.lines[i].startMs - this.lines[i - 1].endMs
      if (gap < 2000) {
        currentStreak++
        longestBarStreak = Math.max(longestBarStreak, currentStreak)
      } else {
        currentStreak = 1
      }
    }

    // Silence ratio
    const totalVocalTime = barLengths.reduce((a, b) => a + b, 0)
    const silenceRatio = durationMs > 0
      ? Math.round((1 - totalVocalTime / durationMs) * 100) / 100
      : 1

    // Vocabulary
    const allWords = this.lines
      .flatMap(l => l.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/))
      .filter(w => w.length > 0)
    const wordCounts = new Map<string, number>()
    for (const w of allWords) {
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1)
    }
    const uniqueWords = wordCounts.size
    const lexicalDiversity = totalWords > 0
      ? Math.round((uniqueWords / totalWords) * 100) / 100
      : 0
    const topWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }))

    // Cadence consistency: stddev of syllable rates across lines
    const syllableRates = this.lines
      .filter(l => (l.endMs - l.startMs) > 200)
      .map(l => l.syllables / ((l.endMs - l.startMs) / 1000))
    const avgRate = syllableRates.length > 0
      ? syllableRates.reduce((a, b) => a + b, 0) / syllableRates.length
      : 0
    const rateVariance = syllableRates.length > 1
      ? syllableRates.reduce((a, b) => a + (b - avgRate) ** 2, 0) / syllableRates.length
      : 0
    const rateStddev = Math.sqrt(rateVariance)
    // Consistency: 1 when stddev is 0, approaches 0 as stddev increases
    const cadenceConsistency = avgRate > 0
      ? Math.round(Math.max(0, 1 - rateStddev / avgRate) * 100) / 100
      : 0

    // Overall score (0-100)
    let score = 0

    // Flow (40 points)
    const wpmScore = Math.min(1, wordsPerMinute / 200) * 15    // fast rapping = more points
    const lineScore = Math.min(1, totalLines / 20) * 10         // more bars = more points
    const streakScore = Math.min(1, longestBarStreak / 8) * 10  // consistency
    const cadenceScore = cadenceConsistency * 5                  // steady flow
    score += wpmScore + lineScore + streakScore + cadenceScore

    // Vocabulary (20 points)
    const diversityScore = lexicalDiversity * 10
    const vocabSizeScore = Math.min(1, uniqueWords / 80) * 10
    score += diversityScore + vocabSizeScore

    // Engagement (20 points)
    const silenceScore = (1 - silenceRatio) * 10                // less silence = better
    const durationScore = Math.min(1, durationMs / 180000) * 10 // up to 3 min
    score += silenceScore + durationScore

    // Beat interaction (20 points)
    const dropScore = Math.min(1, this.drops.length / 5) * 7
    const vibeScore = Math.min(1, this.vibeChanges.length / 3) * 6
    const commandScore = Math.min(1, this.voiceCommands.length / 5) * 7
    score += dropScore + vibeScore + commandScore

    const overallScore = Math.round(Math.max(0, Math.min(100, score)))

    // Grade
    let grade: string
    if (overallScore >= 95) grade = 'A+'
    else if (overallScore >= 90) grade = 'A'
    else if (overallScore >= 85) grade = 'A-'
    else if (overallScore >= 80) grade = 'B+'
    else if (overallScore >= 75) grade = 'B'
    else if (overallScore >= 70) grade = 'B-'
    else if (overallScore >= 65) grade = 'C+'
    else if (overallScore >= 60) grade = 'C'
    else if (overallScore >= 55) grade = 'C-'
    else if (overallScore >= 50) grade = 'D+'
    else if (overallScore >= 45) grade = 'D'
    else grade = 'F'

    // Strengths and improvements
    const strengths: string[] = []
    const improvements: string[] = []

    if (wordsPerMinute > 120) strengths.push('Fast flow — impressive delivery speed')
    else if (wordsPerMinute < 60 && totalLines > 3) improvements.push('Try picking up the pace — aim for 80+ WPM')

    if (lexicalDiversity > 0.7) strengths.push('Rich vocabulary — great word variety')
    else if (lexicalDiversity < 0.4 && totalWords > 20) improvements.push('Try using more diverse vocabulary')

    if (cadenceConsistency > 0.7) strengths.push('Steady cadence — locked in with the beat')
    else if (cadenceConsistency < 0.4 && totalLines > 5) improvements.push('Work on keeping a steady rhythm')

    if (longestBarStreak >= 8) strengths.push('Great endurance — long unbroken streak')
    else if (totalLines > 5 && longestBarStreak < 3) improvements.push('Try to maintain longer continuous flows')

    if (silenceRatio < 0.3) strengths.push('Minimal dead air — kept the energy up')
    else if (silenceRatio > 0.6) improvements.push('Fill more silence — keep the words flowing')

    if (this.drops.length >= 3) strengths.push('Beat commander — triggered multiple drops')
    if (this.voiceCommands.length >= 3) strengths.push('Voice control master — steered the beat effectively')
    if (this.genresVisited.size >= 3) strengths.push('Genre surfer — explored multiple vibes')

    if (strengths.length === 0) strengths.push('You showed up and freestyled — that takes guts!')
    if (improvements.length === 0) improvements.push('Keep experimenting with flow patterns and wordplay')

    const report: FreestyleReport = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      durationMs: Math.round(durationMs),
      bpm: this.bpm,
      totalWords,
      totalSyllables,
      totalLines,
      wordsPerMinute,
      syllablesPerBeat,
      averageBarLengthMs,
      longestBarStreak,
      silenceRatio,
      uniqueWords,
      lexicalDiversity,
      topWords,
      dropsTriggered: this.drops.length,
      vibeChanges: this.vibeChanges.length,
      voiceCommands: this.voiceCommands.length,
      genresVisited: [...this.genresVisited],
      cadenceConsistency,
      averageSyllableRate: Math.round(avgRate * 100) / 100,
      overallScore,
      grade,
      strengths,
      improvements,
    }

    // Emit event for UI
    window.dispatchEvent(new CustomEvent('organism:report-card', {
      detail: report,
    }))

    return report
  }

  /** Check if session is active. */
  getIsActive(): boolean {
    return this.isActive
  }

  /** Get current session ID. */
  getSessionId(): string {
    return this.sessionId
  }

  /** Dispose. */
  dispose(): void {
    this.isActive = false
    this.lines = []
    this.drops = []
    this.vibeChanges = []
    this.voiceCommands = []
    this.genresVisited.clear()
  }
}
