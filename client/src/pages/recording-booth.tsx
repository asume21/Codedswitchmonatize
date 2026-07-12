import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as Tone from 'tone'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/queryClient'
import { useOrganismSafe, useOrganismActivation } from '@/features/organism/GlobalOrganismWrapper'
import {
  Mic, MicOff, Radio, Music, Circle, Square, Play, Pause,
  Download, Trash2, Headphones, Volume2, VolumeX, Clock,
  Zap, Flame, Snowflake, Wind, Layers, Sparkles, Cpu,
  CheckCircle2, Merge, AudioLines,
} from 'lucide-react'
import { useLocation } from 'wouter'
import { getAudioContext, resumeAudioContext } from '@/lib/audioContext'
import { registerAudioDebugSource } from '@/lib/audioDebugBridge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickBeat {
  id: string; name: string; bpm: number; style: string; color: AccentColor;
  icon: React.ElementType;
  url: string;
  organismPresetId: string;
}

interface Song {
  id: string;
  name: string;
  accessibleUrl?: string | null;
  originalUrl?: string | null;
  songURL?: string | null;
  duration: number | null;
  genre: string | null;
  format?: string | null;
}

interface LocalTake {
  id: string; name: string; createdAt: number; durationMs: number
  vocalBlob: Blob; vocalUrl: string
  beatBlob: Blob | null; beatUrl: string | null
}

type AccentColor = 'purple' | 'red' | 'amber' | 'blue' | 'emerald' | 'violet'

const ACCENT_STYLES: Record<AccentColor, {
  activeCard: string
  icon: string
  bar: string
  text: string
}> = {
  purple: {
    activeCard: 'border-purple-500/60 bg-purple-500/15',
    icon: 'text-purple-400',
    bar: 'bg-purple-400',
    text: 'text-purple-400',
  },
  red: {
    activeCard: 'border-red-500/60 bg-red-500/15',
    icon: 'text-red-400',
    bar: 'bg-red-400',
    text: 'text-red-400',
  },
  amber: {
    activeCard: 'border-amber-500/60 bg-amber-500/15',
    icon: 'text-amber-400',
    bar: 'bg-amber-400',
    text: 'text-amber-400',
  },
  blue: {
    activeCard: 'border-blue-500/60 bg-blue-500/15',
    icon: 'text-blue-400',
    bar: 'bg-blue-400',
    text: 'text-blue-400',
  },
  emerald: {
    activeCard: 'border-emerald-500/60 bg-emerald-500/15',
    icon: 'text-emerald-400',
    bar: 'bg-emerald-400',
    text: 'text-emerald-400',
  },
  violet: {
    activeCard: 'border-violet-500/60 bg-violet-500/15',
    icon: 'text-violet-400',
    bar: 'bg-violet-400',
    text: 'text-violet-400',
  },
}

// ─── Quick Beat Definitions ───────────────────────────────────────────────────

const QUICK_BEATS: QuickBeat[] = [
  {
    id: 'juice-wrld', name: 'Lucid Dreams', bpm: 80, style: 'Juice Wrld Type', color: 'purple', icon: Sparkles,
    url: '/api/reference-beats/Juice Wrld Type Beat - oxy80.mp3',
    organismPresetId: 'ref-lucid-dreams-80',
  },
  {
    id: 'dababy', name: 'Rain On Me', bpm: 140, style: 'DaBaby Type', color: 'red', icon: Flame,
    url: '/api/reference-beats/Rain On Me _ DaBaby TypeBeat .mp3',
    organismPresetId: 'ref-dababy-140',
  },
  {
    id: 'violin-trap', name: 'Orchestral Trap', bpm: 130, style: 'Violin Trap', color: 'amber', icon: Layers,
    url: '/api/reference-beats/Violin Trap HipHop Type Beat (2).mp3',
    organismPresetId: 'ref-violin-trap-130',
  },
  {
    id: 'weekend', name: 'The Weekend', bpm: 110, style: 'R&B / Pop', color: 'blue', icon: Snowflake,
    url: '/api/reference-beats/Weekend .mp3',
    organismPresetId: 'ref-weekend-110',
  },
  {
    id: 'reference-05', name: 'Reference 05', bpm: 120, style: 'Alt Trap / Pop', color: 'emerald', icon: AudioLines,
    url: '/api/reference-beats/NAHps9_SuYI_Audio.m4a',
    organismPresetId: 'ref-alt-pop-120',
  },
  {
    id: 'reference-06', name: 'Reference 06', bpm: 96, style: 'Dark Pocket', color: 'violet', icon: Wind,
    url: '/api/reference-beats/paDu23b1PmU_Audio.m4a',
    organismPresetId: 'ref-dark-pocket-96',
  },
]

const PRESET_ICON_MAP: Record<string, React.ElementType> = {
  'ref-lucid-dreams-80': Sparkles,
  'ref-dababy-140': Flame,
  'ref-violin-trap-130': Layers,
  'ref-weekend-110': Snowflake,
  'ref-alt-pop-120': AudioLines,
  'ref-dark-pocket-96': Wind,
  'trap-140': Flame,
  'melodic-trap-136': Sparkles,
  'lofi-85': Snowflake,
  'boombap-90': Radio,
  'drill-140': Zap,
  'chill-75': Wind,
  'funk-100': Music,
  'cypher-90': Mic,
  'storytelling-80': Layers,
}

const PRESET_COLOR_MAP: Record<string, AccentColor> = {
  'ref-lucid-dreams-80': 'purple',
  'ref-dababy-140': 'red',
  'ref-violin-trap-130': 'amber',
  'ref-weekend-110': 'blue',
  'ref-alt-pop-120': 'emerald',
  'ref-dark-pocket-96': 'violet',
  'trap-140': 'red',
  'melodic-trap-136': 'purple',
  'lofi-85': 'blue',
  'boombap-90': 'amber',
  'drill-140': 'violet',
  'chill-75': 'emerald',
  'funk-100': 'amber',
  'cypher-90': 'violet',
  'storytelling-80': 'blue',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function extractUploadFileId(url: string): string | null {
  for (const marker of ['/api/internal/uploads/', '/uploads/', '/objects/']) {
    if (url.includes(marker)) {
      return decodeURIComponent(url.split(marker)[1]?.split('?')[0] ?? '') || null
    }
  }
  return null
}

function resolveSongPlaybackUrl(song: Song): string | null {
  let url = song.accessibleUrl || song.originalUrl || song.songURL || null
  if (!url) return null

  const format = (song.format || '').toLowerCase()
  const lowerUrl = url.toLowerCase()
  const isMp3 = format === 'mp3' || lowerUrl.includes('.mp3')
  const isConverted = url.includes('/api/songs/converted/') || url.includes('/api/songs/convert-and-play/')

  if (!isMp3 && !isConverted) {
    const fileId = extractUploadFileId(url)
    if (fileId) {
      url = `/api/songs/convert-and-play/${encodeURIComponent(fileId)}`
    }
  }

  if (url.includes('/api/internal/uploads/')) {
    url = url.includes('?') ? `${url}&direct=true` : `${url}?direct=true`
  }

  const cacheKey = url.includes('?') ? '&t=' : '?t='
  return `${url}${cacheKey}${Date.now()}`
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels
  const len = buffer.length
  const sr = buffer.sampleRate
  const ab = new ArrayBuffer(44 + len * numCh * 2)
  const v = new DataView(ab)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + len * numCh * 2, true)
  str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, numCh, true); v.setUint32(24, sr, true)
  v.setUint32(28, sr * numCh * 2, true); v.setUint16(32, numCh * 2, true)
  v.setUint16(34, 16, true); str(36, 'data')
  v.setUint32(40, len * numCh * 2, true)
  let off = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

async function blobToWav(blob: Blob): Promise<Blob> {
  const ac = getAudioContext()
  const buf = await ac.decodeAudioData(await blob.arrayBuffer())
  return audioBufferToWavBlob(buf)
}

async function mixBlobsToWav(vocalBlob: Blob, beatBlob: Blob | null): Promise<Blob> {
  const ac = getAudioContext()
  const vocalAb = await vocalBlob.arrayBuffer()
  const vocalBuf = await ac.decodeAudioData(vocalAb)
  let beatBuf: AudioBuffer | null = null
  if (beatBlob) {
    const beatAb = await beatBlob.arrayBuffer()
    beatBuf = await ac.decodeAudioData(beatAb)
  }
  const duration = Math.max(vocalBuf.duration, beatBuf?.duration ?? 0)
  const offAc = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100)
  const vs = offAc.createBufferSource(); vs.buffer = vocalBuf
  vs.connect(offAc.destination); vs.start(0)
  if (beatBuf) {
    const bs = offAc.createBufferSource(); bs.buffer = beatBuf
    const gain = offAc.createGain(); gain.gain.value = 0.75
    bs.connect(gain); gain.connect(offAc.destination); bs.start(0)
  }
  const rendered = await offAc.startRendering()
  return audioBufferToWavBlob(rendered)
}

// ─── Main Component ───────────────────────────────────────────────────────────

type BeatSource = 'quick-beats' | 'my-songs' | 'organism' | 'upload'

export default function RecordingBooth() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { isActivated, activate } = useOrganismActivation()
  const organism = useOrganismSafe()

  const [beatSource, setBeatSource] = useState<BeatSource>('quick-beats')
  const [selectedBeat, setSelectedBeat] = useState<QuickBeat | null>(null)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [isBeatPlaying, setIsBeatPlaying] = useState(false)
  const [beatVolume, setBeatVolume] = useState(0.8)
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied' | 'requesting'>('unknown')
  const [isRecording, setIsRecording] = useState(false)
  const [countingIn, setCountingIn] = useState(false)
  const [countInBeats, setCountInBeats] = useState<4 | 0>(4)
  const [countBeat, setCountBeat] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [takes, setTakes] = useState<LocalTake[]>([])
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [isMixing, setIsMixing] = useState<string | null>(null)

  // Uploaded beat state
  const [uploadedBeatUrl,  setUploadedBeatUrl]  = useState<string | null>(null)
  const [uploadedBeatName, setUploadedBeatName] = useState('')

  // Quick Beat playback. Use native media playback for long MP3/M4A reference tracks,
  // then route through Web Audio so the beat can still be captured while recording.
  const quickBeatAudioRef = useRef<HTMLAudioElement | null>(null)
  const quickBeatSrcRef = useRef<MediaElementAudioSourceNode | null>(null)
  const quickBeatGainRef = useRef<GainNode | null>(null)
  // Unregisters the beat's gain node from WebEar's capture tap (see
  // audioDebugBridge.ts — without this, WebEar hears nothing even though the
  // beat plays audibly, since it bypasses Tone's destination entirely).
  const quickBeatUnregisterTapRef = useRef<(() => void) | null>(null)

  // Uploaded beat Web Audio nodes
  const uploadedAudioRef = useRef<HTMLAudioElement | null>(null)
  const uploadedSrcRef   = useRef<MediaElementAudioSourceNode | null>(null)
  const uploadedGainRef  = useRef<GainNode | null>(null)
  const uploadedUnregisterTapRef = useRef<(() => void) | null>(null)

  // Beat recording — captures what plays through speakers
  const beatRecDestRef  = useRef<MediaStreamAudioDestinationNode | null>(null)
  const beatRecorderRef = useRef<MediaRecorder | null>(null)
  const beatChunksRef   = useRef<Blob[]>([])

  // My Songs
  const audioElRef     = useRef<HTMLAudioElement | null>(null)
  const audioSrcRef    = useRef<MediaElementAudioSourceNode | null>(null)
  const songGainRef    = useRef<GainNode | null>(null)
  const songUnregisterTapRef = useRef<(() => void) | null>(null)

  // Mic / recording
  const micStreamRef     = useRef<MediaStream | null>(null)
  const micRecorderRef   = useRef<MediaRecorder | null>(null)
  const micChunksRef     = useRef<Blob[]>([])
  const startTimeRef     = useRef(0)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const countInTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // VU meter
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vuRafRef    = useRef<number | null>(null)

  // Take playback
  const vocalAudioRef = useRef<HTMLAudioElement | null>(null)
  const beatAudioRef  = useRef<HTMLAudioElement | null>(null)

  const { data: songs = [] } = useQuery<Song[]>({
    queryKey: ['/api/songs'],
    queryFn: () => apiRequest('GET', '/api/songs').then(r => r.json()),
    staleTime: 60_000,
  })

  useEffect(() => {
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(r => {
        setMicPermission(r.state === 'granted' ? 'granted' : r.state === 'denied' ? 'denied' : 'unknown')
        r.onchange = () => setMicPermission(r.state === 'granted' ? 'granted' : r.state === 'denied' ? 'denied' : 'unknown')
      }).catch(() => {})
  }, [])

  useEffect(() => { if (!isActivated) activate() }, [activate, isActivated])

  // ── Beat recording destination (created once, reused) ────────────────────────

  const ensureBeatRecDest = useCallback(() => {
    if (beatRecDestRef.current) return beatRecDestRef.current
    const rawAC = getAudioContext()
    const dest = rawAC.createMediaStreamDestination()
    beatRecDestRef.current = dest
    return dest
  }, [])

  // ── VU meter ─────────────────────────────────────────────────────────────────

  const startVuMeter = useCallback((stream: MediaStream) => {
    const rawAC = getAudioContext()
    if (analyserRef.current) analyserRef.current.disconnect()
    const analyser = rawAC.createAnalyser()
    analyser.fftSize = 256
    analyserRef.current = analyser
    rawAC.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) { const n = (v - 128) / 128; sum += n * n }
      setInputLevel(Math.min(1, Math.sqrt(sum / data.length) * 6))
      vuRafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  const stopVuMeter = useCallback(() => {
    if (vuRafRef.current) cancelAnimationFrame(vuRafRef.current)
    vuRafRef.current = null
    setInputLevel(0)
  }, [])

  // ── Quick Beats ───────────────────────────────────────────────────────────────

  const stopQuickBeat = useCallback(async () => {
    const el = quickBeatAudioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
      el.removeAttribute('src')
      el.load()
    }
    quickBeatSrcRef.current?.disconnect()
    quickBeatGainRef.current?.disconnect()
    quickBeatUnregisterTapRef.current?.()
    quickBeatUnregisterTapRef.current = null
    quickBeatAudioRef.current = null
    quickBeatSrcRef.current = null
    quickBeatGainRef.current = null
    setIsBeatPlaying(false)
  }, [])

  const playQuickBeat = useCallback(async (beat: QuickBeat) => {
    if (isBeatPlaying) await stopQuickBeat()
    getAudioContext()
    await resumeAudioContext()
    await Tone.start()

    // Beat bus — routes the reference track to both speakers AND recording destination.
    const rawAC = getAudioContext()
    const recDest = ensureBeatRecDest()
    const audio = new Audio(encodeURI(beat.url))
    audio.crossOrigin = 'anonymous'
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = beatVolume

    const source = rawAC.createMediaElementSource(audio)
    const gain = rawAC.createGain()
    gain.gain.value = beatVolume
    source.connect(gain)
    gain.connect(rawAC.destination)
    gain.connect(recDest)

    quickBeatUnregisterTapRef.current = registerAudioDebugSource({
      connect: (destination) => gain.connect(destination as unknown as AudioNode),
      disconnect: (destination) => gain.disconnect(destination as unknown as AudioNode),
    })

    quickBeatAudioRef.current = audio
    quickBeatSrcRef.current = source
    quickBeatGainRef.current = gain
    setSelectedBeat(beat)

    audio.onerror = () => {
      void stopQuickBeat()
      toast({ title: 'Beat failed to load', description: beat.name, variant: 'destructive' })
    }

    try {
      await audio.play()
      if (quickBeatAudioRef.current === audio) setIsBeatPlaying(true)
    } catch {
      await stopQuickBeat()
      toast({ title: 'Beat failed to play', description: beat.name, variant: 'destructive' })
    }
  }, [isBeatPlaying, stopQuickBeat, beatVolume, ensureBeatRecDest, toast])

  // ── My Songs ──────────────────────────────────────────────────────────────────

  const stopSong = useCallback(() => {
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0 }
    setIsBeatPlaying(false)
  }, [])

  const toggleSong = useCallback(async (song: Song) => {
    if (selectedSong?.id === song.id && isBeatPlaying) { stopSong(); return }

    const songUrl = resolveSongPlaybackUrl(song)
    if (!songUrl) {
      toast({ title: 'Playback failed', description: 'No audio URL found for this song.', variant: 'destructive' })
      return
    }

    const rawAC = getAudioContext()
    if (rawAC.state === 'suspended') await rawAC.resume()

    if (!audioElRef.current) audioElRef.current = new Audio()
    const el = audioElRef.current
    el.crossOrigin = 'anonymous'
    el.src = songUrl
    el.volume = 1  // volume controlled via gain node below
    el.loop = true

    // Connect through Web Audio only once per element instance
    if (!audioSrcRef.current) {
      const src = rawAC.createMediaElementSource(el)
      const gainNode = rawAC.createGain()
      gainNode.gain.value = beatVolume
      src.connect(gainNode)
      gainNode.connect(rawAC.destination)          // speakers
      gainNode.connect(ensureBeatRecDest())         // recording
      audioSrcRef.current = src
      songGainRef.current = gainNode
      songUnregisterTapRef.current = registerAudioDebugSource({
        connect: (destination) => gainNode.connect(destination as unknown as AudioNode),
        disconnect: (destination) => gainNode.disconnect(destination as unknown as AudioNode),
      })
    }

    setSelectedSong(song)
    try { await el.play(); setIsBeatPlaying(true) }
    catch {
      setIsBeatPlaying(false)
      toast({ title: 'Playback failed', description: song.name, variant: 'destructive' })
    }
  }, [selectedSong, isBeatPlaying, stopSong, beatVolume, toast, ensureBeatRecDest])

  // ── Organism ──────────────────────────────────────────────────────────────────

  const isOrganismRunning = !!organism?.isRunning
  const isOrganismStarting = !!organism?.isStarting
  const activeOrganismPreset = organism?.activePresetId
    ? organism.quickStartPresets.find(preset => preset.id === organism.activePresetId) ?? null
    : null

  const handleOrganismPreset = async (presetId: string) => {
    if (!organism) {
      toast({ title: 'Organism unavailable', description: 'The AI beat engine is still initializing.', variant: 'destructive' })
      return
    }
    if (isOrganismStarting) return
    getAudioContext()
    await resumeAudioContext()
    await Tone.start()
    if (isOrganismRunning) {
      await organism.swapPreset(presetId)
    } else {
      await organism.quickStart(presetId)
      setIsBeatPlaying(true)
    }
  }

  const stopOrganism = () => { organism?.stop(); setIsBeatPlaying(false) }

  // ── Uploaded Beat ─────────────────────────────────────────────────────────────

  const stopUploadedBeat = useCallback(() => {
    if (uploadedAudioRef.current) { uploadedAudioRef.current.pause(); uploadedAudioRef.current.currentTime = 0 }
    uploadedSrcRef.current?.disconnect()
    uploadedGainRef.current?.disconnect()
    uploadedUnregisterTapRef.current?.()
    uploadedUnregisterTapRef.current = null
    uploadedAudioRef.current = null
    uploadedSrcRef.current   = null
    uploadedGainRef.current  = null
    setIsBeatPlaying(false)
  }, [])

  const playUploadedBeat = useCallback(async (url: string) => {
    stopUploadedBeat()
    await resumeAudioContext()
    await Tone.start()
    const rawAC  = getAudioContext()
    const recDest = ensureBeatRecDest()
    const audio  = new Audio(url)
    audio.loop   = true
    audio.preload = 'auto'

    const source = rawAC.createMediaElementSource(audio)
    const gain   = rawAC.createGain()
    gain.gain.value = beatVolume
    source.connect(gain)
    gain.connect(rawAC.destination)
    gain.connect(recDest)

    uploadedUnregisterTapRef.current = registerAudioDebugSource({
      connect: (destination) => gain.connect(destination as unknown as AudioNode),
      disconnect: (destination) => gain.disconnect(destination as unknown as AudioNode),
    })

    uploadedAudioRef.current = audio
    uploadedSrcRef.current   = source
    uploadedGainRef.current  = gain

    try {
      await audio.play()
      if (uploadedAudioRef.current === audio) setIsBeatPlaying(true)
    } catch {
      stopUploadedBeat()
      toast({ title: 'Beat failed to play', variant: 'destructive' })
    }
  }, [stopUploadedBeat, beatVolume, ensureBeatRecDest, toast])

  const handleBeatFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (uploadedBeatUrl) URL.revokeObjectURL(uploadedBeatUrl)
    const url = URL.createObjectURL(file)
    setUploadedBeatUrl(url)
    setUploadedBeatName(file.name.replace(/\.[^.]+$/, ''))
    setBeatSource('upload')
    void playUploadedBeat(url)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [uploadedBeatUrl, playUploadedBeat])

  const generateAiBeatFromReference = async (beat: QuickBeat) => {
    if (isRecording) return
    await stopQuickBeat()
    stopSong()
    setSelectedBeat(beat)
    setBeatSource('organism')
    toast({ title: 'Generating AI beat', description: `${beat.name} lane, no loop.` })
    await handleOrganismPreset(beat.organismPresetId)
  }

  // ── Volume sync ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (quickBeatAudioRef.current) quickBeatAudioRef.current.volume = beatVolume
    if (quickBeatGainRef.current) quickBeatGainRef.current.gain.value = beatVolume
    if (audioElRef.current) audioElRef.current.volume = beatVolume
    if (uploadedGainRef.current) uploadedGainRef.current.gain.value = beatVolume
  }, [beatVolume])

  // ── Mic permission ────────────────────────────────────────────────────────────

  const requestMicPermission = useCallback(async () => {
    setMicPermission('requesting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach(t => t.stop())
      setMicPermission('granted')
    } catch {
      setMicPermission('denied')
      toast({ title: 'Mic blocked', variant: 'destructive' })
    }
  }, [toast])

  // ── Recording ─────────────────────────────────────────────────────────────────

  const doRecord = useCallback(async () => {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    micStreamRef.current = micStream
    startVuMeter(micStream)

    // Vocal recorder
    micChunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm'
    const micRec = new MediaRecorder(micStream, { mimeType, audioBitsPerSecond: 256000 })
    micRecorderRef.current = micRec
    micRec.ondataavailable = e => { if (e.data.size > 0) micChunksRef.current.push(e.data) }

    // Beat recorder — only for Quick Beats / My Songs (organism uses its own recorder)
    beatChunksRef.current = []
    const beatRec = (beatSource !== 'organism' && beatRecDestRef.current)
      ? new MediaRecorder(beatRecDestRef.current.stream, { mimeType, audioBitsPerSecond: 256000 })
      : null
    beatRecorderRef.current = beatRec
    if (beatRec) {
      beatRec.ondataavailable = e => { if (e.data.size > 0) beatChunksRef.current.push(e.data) }
    }

    // If organism mode, start organism beat recording — pass our already-open
    // mic stream so it doesn't open a second competing getUserMedia session.
    if (beatSource === 'organism' && organism?.startRecording) {
      await organism.startRecording(micStream)
    }

    const captureStop = async () => {
      const vocalBlob = new Blob(micChunksRef.current, { type: mimeType })
      const vocalUrl  = URL.createObjectURL(vocalBlob)

      let beatBlob: Blob | null = null
      let beatUrl:  string | null = null

      if (beatSource === 'organism' && organism?.stopRecording) {
        const session = await organism.stopRecording()
        if (session?.beatBlob) {
          beatBlob = session.beatBlob
          beatUrl  = URL.createObjectURL(beatBlob)
        }
      } else if (beatChunksRef.current.length > 0) {
        beatBlob = new Blob(beatChunksRef.current, { type: mimeType })
        beatUrl  = URL.createObjectURL(beatBlob)
      }

      const durationMs = Date.now() - startTimeRef.current
      setTakes(prev => [{
        id: crypto.randomUUID(),
        name: `Take ${prev.length + 1}`,
        createdAt: Date.now(),
        durationMs,
        vocalBlob, vocalUrl,
        beatBlob,  beatUrl,
      }, ...prev])

      micStream.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
      stopVuMeter()
    }

    micRec.onstop = captureStop

    micRec.start(100)
    beatRec?.start(100)
    startTimeRef.current = Date.now()
    setIsRecording(true)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 100)
  }, [beatSource, organism, startVuMeter, stopVuMeter])

  const startRecord = useCallback(async () => {
    if (micPermission !== 'granted') { await requestMicPermission(); return }
    if (beatSource === 'organism' && !isOrganismRunning) return
    if (beatSource === 'upload' && !uploadedBeatUrl) return
    if (countInBeats > 0) {
      await resumeAudioContext()
      await Tone.start()
      const metro = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.04, release: 0.01 }, harmonicity: 5.1, modulationIndex: 16, resonance: 3000, octaves: 0.5 }).toDestination()
      metro.frequency.value = 1000; metro.volume.value = -6
      setCountingIn(true); setCountBeat(0)
      let b = 0
      const countInBpm = beatSource === 'organism'
        ? activeOrganismPreset?.bpm ?? 90
        : selectedBeat?.bpm ?? 90
      const interval = (60 / countInBpm) * 1000
      if (countInTimerRef.current) clearInterval(countInTimerRef.current)
      const ct = setInterval(() => {
        b++; metro.triggerAttackRelease('C5', '32n'); setCountBeat(b)
        if (b >= countInBeats) {
          clearInterval(ct)
          countInTimerRef.current = null
          setCountingIn(false)
          metro.dispose()
          void doRecord()
        }
      }, interval)
      countInTimerRef.current = ct
    } else {
      void doRecord()
    }
  }, [micPermission, beatSource, isOrganismRunning, countInBeats, activeOrganismPreset, selectedBeat, doRecord, requestMicPermission])

  const stopRecord = useCallback(() => {
    if (countInTimerRef.current) { clearInterval(countInTimerRef.current); countInTimerRef.current = null }
    setCountingIn(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (beatRecorderRef.current?.state === 'recording') beatRecorderRef.current.stop()
    beatRecorderRef.current = null
    if (micRecorderRef.current?.state === 'recording') micRecorderRef.current.stop()
    micRecorderRef.current = null
    setIsRecording(false); setElapsed(0)
  }, [])

  // ── Take playback ─────────────────────────────────────────────────────────────

  const playTake = useCallback((take: LocalTake) => {
    vocalAudioRef.current?.pause(); vocalAudioRef.current = null
    beatAudioRef.current?.pause();  beatAudioRef.current = null
    if (playingTakeId === take.id) { setPlayingTakeId(null); return }

    const v = new Audio(take.vocalUrl)
    vocalAudioRef.current = v
    v.onended = () => setPlayingTakeId(null)

    if (take.beatUrl) {
      const b = new Audio(take.beatUrl)
      beatAudioRef.current = b
      b.volume = 0.75
    }

    Promise.all([v.play(), beatAudioRef.current?.play() ?? Promise.resolve()])
      .catch(() => {})
    setPlayingTakeId(take.id)
  }, [playingTakeId])

  const mixAndDownload = useCallback(async (take: LocalTake) => {
    setIsMixing(take.id)
    try {
      const wav = await mixBlobsToWav(take.vocalBlob, take.beatBlob)
      const url = URL.createObjectURL(wav)
      const a = document.createElement('a'); a.href = url; a.download = `${take.name}-mixed.wav`; a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Mixed! Downloading WAV' })
    } catch {
      toast({ title: 'Mix failed', variant: 'destructive' })
    } finally { setIsMixing(null) }
  }, [toast])

  const sendToStudio = useCallback(async (take: LocalTake) => {
    setIsMixing(take.id) // Reuse loading state
    try {
      const uploadBlob = async (rawBlob: Blob, name: string) => {
        // Convert the raw MediaRecorder blob (webm/ogg) to proper WAV before upload
        const wav = await blobToWav(rawBlob)
        const upRes = await apiRequest("POST", "/api/objects/upload", { format: "wav", fileName: `${name}.wav` });
        const { uploadURL } = await upRes.json();
        await fetch(uploadURL, { method: "PUT", body: wav, headers: { "Content-Type": "audio/wav" } });
        const songRes = await apiRequest("POST", "/api/songs/upload", {
          songURL: uploadURL,
          name,
          fileSize: wav.size,
          format: "wav",
          mimeType: "audio/wav",
          duration: take.durationMs / 1000
        });
        return songRes.json();
      };

      toast({ title: 'Uploading tracks to Studio...' });
      await uploadBlob(take.vocalBlob, `${take.name} (Vocal)`);
      
      if (take.beatBlob) {
        await uploadBlob(take.beatBlob, `${take.name} (Beat)`);
      } else if (take.beatUrl && selectedBeat) {
         // If it's a quick beat, we can just save a reference to it
         await apiRequest("POST", "/api/songs/upload", {
            songURL: take.beatUrl,
            name: `${take.name} (Instrumental)`,
            format: "mp3",
            duration: take.durationMs / 1000
         });
      }

      toast({ title: 'Success', description: 'Tracks added to your library! Opening Mixer...' });
      window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'mixer' }));
      setTimeout(() => setLocation('/studio?tab=mixer'), 500);
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' })
    } finally {
      setIsMixing(null)
    }
  }, [toast, selectedBeat, setLocation]);

  const downloadTrack = useCallback((url: string, name: string) => {
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  }, [])

  const deleteTake = useCallback((id: string) => {
    vocalAudioRef.current?.pause(); beatAudioRef.current?.pause()
    if (playingTakeId === id) setPlayingTakeId(null)
    setTakes(prev => {
      const t = prev.find(x => x.id === id)
      if (t) { URL.revokeObjectURL(t.vocalUrl); if (t.beatUrl) URL.revokeObjectURL(t.beatUrl) }
      return prev.filter(x => x.id !== id)
    })
  }, [playingTakeId])

  // ── Switch source tab ─────────────────────────────────────────────────────────

  const switchSource = (src: BeatSource) => {
    if (isRecording) return
    if (isBeatPlaying) {
      if (beatSource === 'quick-beats') void stopQuickBeat()
      else if (beatSource === 'my-songs') stopSong()
      else if (beatSource === 'upload') stopUploadedBeat()
      else stopOrganism()
    }
    setBeatSource(src)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  useEffect(() => () => {
    void stopQuickBeat()
    stopSong()
    // My Songs' gain node is intentionally kept connected across pause/play
    // (see toggleSong), so it isn't torn down by stopSong — unregister it
    // here on unmount so the WebEar tap doesn't hold a strong reference to
    // it forever.
    songUnregisterTapRef.current?.()
    songUnregisterTapRef.current = null
    stopUploadedBeat()
    if (micRecorderRef.current?.state === 'recording') micRecorderRef.current.stop()
    if (beatRecorderRef.current?.state === 'recording') beatRecorderRef.current.stop()
    if (countInTimerRef.current) clearInterval(countInTimerRef.current)
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    stopVuMeter()
    if (timerRef.current) clearInterval(timerRef.current)
    vocalAudioRef.current?.pause(); beatAudioRef.current?.pause()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vuBars = Array.from({ length: 20 }, (_, i) => i / 19)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Recording Booth</h1>
          <p className="text-muted-foreground text-sm">Pick a beat → Record → Download separate tracks or mix to WAV</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {micPermission === 'granted' && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Mic Ready
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 text-xs">
            <Headphones className="h-3 w-3" /> Wear headphones
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: Beat Picker ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Source tabs */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 flex-wrap">
            {([
              { src: 'quick-beats' as const, label: 'Quick Beats', icon: Zap },
              { src: 'my-songs'    as const, label: 'My Songs',    icon: Music },
              { src: 'organism'    as const, label: 'Organism AI', icon: Radio },
              { src: 'upload'      as const, label: 'Upload Beat', icon: AudioLines },
            ]).map(({ src, label, icon: Icon }) => (
              <button key={src} onClick={() => switchSource(src)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  beatSource === src
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                    : 'text-white/40 hover:text-white/70'
                }`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Quick Beats */}
          {beatSource === 'quick-beats' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {QUICK_BEATS.map(beat => {
                  const active = selectedBeat?.id === beat.id && isBeatPlaying
                  const accent = ACCENT_STYLES[beat.color]
                  return (
                    <button key={beat.id}
                      onClick={() => active ? stopQuickBeat() : playQuickBeat(beat)}
                      className={`group relative p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        active
                          ? accent.activeCard
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}>
                      <div className="flex items-start justify-between mb-2">
                        <beat.icon className={`h-5 w-5 ${active ? accent.icon : 'text-white/30'}`} />
                        {active && <div className="flex gap-0.5">{[1,2,3].map(i => <div key={i} className={`w-1 ${accent.bar} rounded-full animate-bounce`} style={{ height: `${8+i*4}px`, animationDelay: `${i*100}ms` }} />)}</div>}
                      </div>
                      <div className="font-black text-sm uppercase tracking-tight">{beat.name}</div>
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{beat.bpm} BPM · {beat.style}</div>
                      <div className={`mt-2 text-[10px] font-black uppercase tracking-widest ${active ? accent.text : 'text-white/20'}`}>
                        {active ? 'Stop' : 'Play'}
                      </div>
                    </button>
                  )
                })}
              </div>
              {selectedBeat && (
                <div className="flex flex-col gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80">Reference Locked</div>
                    <div className="truncate text-sm font-black text-white">{selectedBeat.name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{selectedBeat.bpm} BPM · Original AI generation target</div>
                  </div>
                  <Button
                    onClick={() => generateAiBeatFromReference(selectedBeat)}
                    disabled={isRecording}
                    className="shrink-0 border border-cyan-400/30 bg-cyan-400/15 px-3 text-[10px] font-black uppercase tracking-widest text-cyan-100 hover:bg-cyan-400/25"
                  >
                    <Cpu className="mr-2 h-3.5 w-3.5" />
                    Generate Similar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* My Songs */}
          {beatSource === 'my-songs' && (
            <div className="space-y-2">
              {songs.length === 0 ? (
                <div className="py-12 text-center text-white/30 space-y-2">
                  <Music className="h-8 w-8 mx-auto opacity-30" />
                  <p className="text-sm">No songs uploaded yet.</p>
                  <a href="/studio" className="text-xs text-cyan-400 hover:underline">Upload in Studio →</a>
                </div>
              ) : songs.map(song => {
                const active = selectedSong?.id === song.id && isBeatPlaying
                return (
                  <button key={song.id} onClick={() => toggleSong(song)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      active ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05]'
                    }`}>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-violet-500/20 border border-violet-500/30' : 'bg-white/5'}`}>
                      {active ? <Pause className="h-4 w-4 text-violet-300" /> : <Play className="h-4 w-4 text-white/50" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{song.name}</div>
                      <div className="text-[10px] text-white/40">{song.genre ?? 'Audio'}{song.duration ? ` · ${formatMs(song.duration * 1000)}` : ''}</div>
                    </div>
                    {active && <div className="flex gap-0.5">{[1,2,3].map(i => <div key={i} className="w-1 bg-violet-400 rounded-full animate-bounce" style={{ height: `${8+i*4}px`, animationDelay: `${i*100}ms` }} />)}</div>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Organism AI */}
          {beatSource === 'organism' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Radio className={`h-4 w-4 text-cyan-400 ${isOrganismRunning ? 'animate-pulse' : ''}`} />
                  <span className="text-xs font-black uppercase tracking-widest text-cyan-400">Live AI Beat</span>
                </div>
                {isOrganismStarting && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] animate-pulse">Starting…</Badge>}
                {isOrganismRunning && !isOrganismStarting && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">Playing</Badge>}
                {!organism && <Badge className="bg-white/10 text-white/40 border-white/10 text-[10px]">Booting…</Badge>}
              </div>
              <p className="text-[11px] text-white/40 px-1">
                Pick a style — AI generates drums, bass &amp; melody in real time. No loops, all live.
              </p>
              {organism?.error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 font-mono">
                  Error: {organism.error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {(organism?.quickStartPresets ?? []).map(preset => {
                  const isActive = isOrganismRunning && organism?.activePresetId === preset.id
                  const PresetIcon = PRESET_ICON_MAP[preset.id] ?? Radio
                  const accent = ACCENT_STYLES[PRESET_COLOR_MAP[preset.id] ?? 'purple']
                  const isThisStarting = isOrganismStarting && organism?.activePresetId === preset.id
                  return (
                    <button key={preset.id} onClick={() => handleOrganismPreset(preset.id)}
                      disabled={isOrganismStarting}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isOrganismStarting ? 'opacity-60 cursor-wait' : 'hover:scale-[1.02]'
                      } ${
                        isActive
                          ? accent.activeCard
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}>
                      <div className="flex items-start justify-between mb-2">
                        <PresetIcon className={`h-5 w-5 ${isActive ? accent.icon : 'text-white/30'}`} />
                        {isActive && <div className="flex gap-0.5">{[1,2,3].map(i => <div key={i} className={`w-1 ${accent.bar} rounded-full animate-bounce`} style={{ height: `${8+i*4}px`, animationDelay: `${i*100}ms` }} />)}</div>}
                        {isThisStarting && <div className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />}
                      </div>
                      <div className="font-black text-sm uppercase tracking-tight">{preset.label}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? accent.text : 'text-white/40'}`}>
                        {preset.bpm} BPM · AI Live
                      </div>
                      <div className={`mt-2 text-[10px] font-black uppercase tracking-widest ${isActive ? accent.text : 'text-white/20'}`}>
                        {isThisStarting ? '⟳ Starting' : isActive ? '● Live' : '▶ Start'}
                      </div>
                    </button>
                  )
                })}
              </div>
              {isOrganismRunning && (
                <Button onClick={stopOrganism}
                  className="w-full bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 font-black uppercase tracking-widest text-xs">
                  <Square className="h-3.5 w-3.5 mr-2" /> Stop Organism
                </Button>
              )}

              {/* Generator mixer — shown when organism is running */}
              {isOrganismRunning && organism && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Generator Mix</p>
                  {([
                    { label: 'Drums',  value: organism.drumsVolume,  set: organism.setDrumsVolume,  color: '#f472b6' },
                    { label: 'Bass',   value: organism.bassVolume,   set: organism.setBassVolume,   color: '#4ade80' },
                    { label: 'Melody', value: organism.melodyVolume, set: organism.setMelodyVolume, color: '#38bdf8' },
                    { label: 'Chords', value: organism.chordVolume,  set: organism.setChordVolume,  color: '#a78bfa' },
                    { label: 'Pads',   value: organism.textureVolume, set: organism.setTextureVolume, color: '#fbbf24' },
                  ] as const).map(({ label, value, set, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider w-12 shrink-0" style={{ color }}>{label}</span>
                      <Slider
                        value={[Math.round(value * 100)]}
                        onValueChange={([v]) => set(v / 100)}
                        min={0} max={200} step={1}
                        className="flex-1"
                      />
                      <span className="text-[10px] text-white/40 w-8 text-right">{Math.round(value * 100)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload Beat */}
          {beatSource === 'upload' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <AudioLines className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-black uppercase tracking-widest text-cyan-400">Upload Your Beat</span>
              </div>
              <p className="text-[11px] text-white/40 px-1">
                Upload any audio file (MP3, WAV, M4A). It will loop while you record.
              </p>

              <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-cyan-500/40 hover:bg-cyan-500/5 cursor-pointer transition-all">
                <AudioLines className="h-8 w-8 text-white/30" />
                <div className="text-center">
                  <div className="text-sm font-bold text-white/70">
                    {uploadedBeatName || 'Choose a beat file'}
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">MP3 · WAV · M4A · OGG</div>
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleBeatFileUpload}
                />
              </label>

              {uploadedBeatUrl && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => isBeatPlaying ? stopUploadedBeat() : void playUploadedBeat(uploadedBeatUrl)}
                    className="flex-1 border-white/20 text-white/70 hover:text-white"
                  >
                    {isBeatPlaying ? <><Square className="h-3.5 w-3.5 mr-2" />Stop</> : <><Play className="h-3.5 w-3.5 mr-2" />Preview</>}
                  </Button>
                  {isBeatPlaying && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      Playing
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Beat volume */}
          {isBeatPlaying && (
            <div className="flex items-center gap-3 px-1">
              <VolumeX className="h-3.5 w-3.5 text-white/30 shrink-0" />
              <Slider value={[beatVolume * 100]} onValueChange={([v]) => setBeatVolume(v / 100)} min={0} max={100} step={1} className="flex-1" />
              <Volume2 className="h-3.5 w-3.5 text-white/30 shrink-0" />
              <span className="text-xs text-white/40 w-8 text-right">{Math.round(beatVolume * 100)}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: Record + Takes ── */}
        <div className="lg:col-span-2 space-y-4">

          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest font-black">Record Your Voice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {micPermission !== 'granted' && (
                <button onClick={requestMicPermission}
                  className="w-full py-3 rounded-xl border border-dashed border-white/20 text-xs font-bold uppercase tracking-widest text-white/40 hover:border-cyan-500/40 hover:text-cyan-400 transition-all flex items-center justify-center gap-2">
                  <Mic className="h-4 w-4" />
                  {micPermission === 'requesting' ? 'Requesting...' : 'Click to enable microphone'}
                </button>
              )}

              {/* VU Meter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/30">
                  <span>Mic Input</span>
                  <span>{isRecording ? '● Recording' : 'Monitoring'}</span>
                </div>
                <div className="h-6 flex items-end gap-0.5 rounded-lg overflow-hidden bg-slate-900 px-1 py-1">
                  {vuBars.map((threshold, i) => (
                    <div key={i} className={`flex-1 rounded-sm transition-all duration-75 ${
                      inputLevel > threshold
                        ? inputLevel > 0.85 ? 'bg-red-400' : inputLevel > 0.6 ? 'bg-yellow-400' : 'bg-emerald-400'
                        : 'bg-white/10'
                    }`} style={{ height: '100%' }} />
                  ))}
                </div>
              </div>

              {/* Count-in */}
              {!isRecording && !countingIn && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Count-in</span>
                  <div className="flex gap-1">
                    {([0, 4] as const).map(n => (
                      <button key={n} onClick={() => setCountInBeats(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                          countInBeats === n ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300' : 'border-white/10 text-white/30 hover:text-white/60'
                        }`}>
                        {n === 0 ? 'Off' : '4 Beats'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {countingIn && (
                <div className="flex items-center justify-center py-2">
                  <div className="text-5xl font-black text-cyan-400 animate-ping">{countBeat}</div>
                </div>
              )}

              {/* REC button */}
              <button
                onClick={isRecording ? stopRecord : startRecord}
                disabled={countingIn || (beatSource === 'organism' && !isOrganismRunning)}
                className={`w-full h-20 rounded-2xl font-black uppercase tracking-[0.15em] text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse'
                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                }`}>
                {isRecording
                  ? <><Square className="h-6 w-6 fill-white" /> Stop Recording</>
                  : <><Circle className="h-6 w-6 fill-white" /> Record</>}
              </button>

              {isRecording && (
                <div className="text-center font-mono text-2xl font-black text-red-400">{formatMs(elapsed)}</div>
              )}

              {beatSource === 'organism' && !isOrganismRunning && (
                <p className="text-[10px] text-white/30 text-center font-bold uppercase tracking-widest">
                  Pick a style on the left first
                </p>
              )}
            </CardContent>
          </Card>

          {/* Takes */}
          {takes.length > 0 && (
            <Card className="border-white/10 bg-white/[0.02]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-widest font-black flex items-center justify-between">
                  <span>Your Takes</span>
                  <Badge variant="outline" className="text-[10px]">{takes.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {takes.map(take => (
                  <div key={take.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold">{take.name}</div>
                        <div className="text-[10px] text-white/30 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {formatMs(take.durationMs)}
                          {take.beatBlob && <span className="ml-1 text-cyan-400/60">· 2 tracks</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => playTake(take)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                            playingTakeId === take.id
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                              : 'border-white/15 text-white/50 hover:text-white'
                          }`}>
                          {playingTakeId === take.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => deleteTake(take.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Track download buttons */}
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => downloadTrack(take.vocalUrl, `${take.name}-vocals.webm`)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold text-white/50 hover:text-white hover:border-white/30 transition-all">
                        <Mic className="h-3 w-3" /> Vocals
                      </button>
                      {take.beatUrl && (
                        <button onClick={() => downloadTrack(take.beatUrl!, `${take.name}-beat.webm`)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold text-white/50 hover:text-white hover:border-white/30 transition-all">
                          <AudioLines className="h-3 w-3" /> Beat
                        </button>
                      )}
                      <button
                        onClick={() => mixAndDownload(take)}
                        disabled={isMixing === take.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/30 text-[10px] font-black text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-50">
                        <Merge className="h-3 w-3" />
                        {isMixing === take.id ? 'Mixing...' : 'Mix → WAV'}
                      </button>
                      <button
                        onClick={() => sendToStudio(take)}
                        disabled={isMixing === take.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-500/30 text-[10px] font-black text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-50">
                        <Merge className="h-3 w-3" />
                        {isMixing === take.id ? 'Sending...' : 'Send to Mixer'}
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
