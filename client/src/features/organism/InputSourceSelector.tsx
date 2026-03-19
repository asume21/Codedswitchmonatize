import React, { useRef, useState } from 'react'
import type { InputSourceType } from '../../organism/input/types'

interface InputSourceSelectorProps {
  current: InputSourceType
  onChange: (type: InputSourceType, file?: File) => void
  disabled?: boolean
  autoEnergy?: 'chill' | 'medium' | 'intense'
  onAutoEnergyChange?: (energy: 'chill' | 'medium' | 'intense') => void
}

const SOURCE_OPTIONS: { type: InputSourceType; label: string; icon: string; desc: string }[] = [
  { type: 'mic', label: 'Microphone', icon: '🎤', desc: 'Speak, rap, freestyle — the organism reacts to your voice' },
  { type: 'midi', label: 'MIDI Controller', icon: '🎹', desc: 'Play keys or pads — velocity & notes drive the organism' },
  { type: 'audioFile', label: 'Audio File', icon: '📁', desc: 'Drop in a beat, vocal, or loop — the organism reacts to it' },
  { type: 'autoGenerate', label: 'Auto-Generate', icon: '🤖', desc: 'Fully autonomous — the organism creates on its own' },
]

const ENERGY_OPTIONS: { value: 'chill' | 'medium' | 'intense'; label: string; color: string }[] = [
  { value: 'chill', label: 'Chill', color: '#60a5fa' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'intense', label: 'Intense', color: '#ef4444' },
]

export function InputSourceSelector({
  current,
  onChange,
  disabled = false,
  autoEnergy = 'medium',
  onAutoEnergyChange,
}: InputSourceSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleSelect = (type: InputSourceType) => {
    if (disabled) return

    if (type === 'audioFile') {
      fileInputRef.current?.click()
      return
    }

    setSelectedFile(null)
    onChange(type)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    onChange('audioFile', file)
    // Reset the input so re-selecting the same file fires onChange
    event.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-tertiary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
      }}>
        Input Source
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {SOURCE_OPTIONS.map((opt) => {
          const isActive = current === opt.type
          return (
            <button
              key={opt.type}
              onClick={() => handleSelect(opt.type)}
              disabled={disabled}
              title={opt.desc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 'var(--border-radius-md)',
                border: isActive
                  ? '1.5px solid var(--color-border-accent)'
                  : '0.5px solid var(--color-border-secondary)',
                background: isActive
                  ? 'var(--color-background-accent-subtle)'
                  : 'var(--color-background-secondary)',
                color: isActive
                  ? 'var(--color-text-accent)'
                  : 'var(--color-text-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 16 }}>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>

      {/* File name display when audio file is selected */}
      {current === 'audioFile' && selectedFile && (
        <div style={{
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          padding: '4px 8px',
          background: 'var(--color-background-tertiary)',
          borderRadius: 'var(--border-radius-sm)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          {selectedFile.name}
        </div>
      )}

      {/* Auto-generate energy selector */}
      {current === 'autoGenerate' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginRight: 4 }}>
            Energy:
          </span>
          {ENERGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onAutoEnergyChange?.(opt.value)}
              disabled={disabled}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--border-radius-sm)',
                border: autoEnergy === opt.value
                  ? `1.5px solid ${opt.color}`
                  : '0.5px solid var(--color-border-secondary)',
                background: autoEnergy === opt.value
                  ? `${opt.color}22`
                  : 'var(--color-background-secondary)',
                color: autoEnergy === opt.value ? opt.color : 'var(--color-text-secondary)',
                fontSize: 12,
                fontWeight: autoEnergy === opt.value ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Description of current mode */}
      <div style={{
        fontSize: 12,
        color: 'var(--color-text-tertiary)',
        lineHeight: 1.4,
      }}>
        {SOURCE_OPTIONS.find((o) => o.type === current)?.desc}
      </div>
    </div>
  )
}
