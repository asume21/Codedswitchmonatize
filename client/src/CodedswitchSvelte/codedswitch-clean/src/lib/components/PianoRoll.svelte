<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { audioEngine } from '$lib/audio/RealisticAudioEngine';
  
  export let notes: Array<{
    id: string;
    pitch: string;
    start: number;
    duration: number;
    velocity: number;
    instrument?: string;
  }> = [];
  
  export let currentStep = 0;
  export let steps = 16;
  export let onNoteAdd: (note: any) => void;
  export let onNoteUpdate: (id: string, changes: any) => void;
  export let isPlaying = false;
  export let selectedInstrument = 'piano';

  const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const OCTAVES = [3, 4, 5];
  const NOTE_HEIGHT = 20;
  const STEP_WIDTH = 40;

  let container: HTMLElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let isMouseDown = false;
  let currentNote: any = null;
  let resizingNote: { id: string; startX: number } | null = null;
  
  // Initialize audio engine when component mounts
  onMount(async () => {
    await audioEngine.initialize();
    setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  function setupCanvas() {
    if (!canvas) return;
    
    // Set canvas size to match container
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        render();
      }
    });
    
    resizeObserver.observe(container);
    
    // Get 2D context
    const context = canvas.getContext('2d');
    if (!context) return;
    
    ctx = context;
    
    // Set up event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    
    // Initial render
    render();
    
    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }
  
  function handleResize() {
    render();
  }
  
  function drawGrid() {
    if (!ctx || !canvas) return;
    
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw horizontal lines (piano keys)
    for (let i = 0; i < OCTAVES.length * 12; i++) {
      const y = i * NOTE_HEIGHT;
      const isBlackKey = [1, 3, 6, 8, 10].includes(i % 12);
      
      // Draw black keys background
      if (isBlackKey) {
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(0, y, width, NOTE_HEIGHT);
      }
      
      // Draw line
      ctx.strokeStyle = i % 12 === 0 ? '#3a3a3a' : '#2a2a2a';
      ctx.lineWidth = i % 12 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      // Draw note names
      if (i % 12 === 0) {
        const octave = Math.floor(i / 12) + 3;
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textBaseline = 'top';
        ctx.fillText(`C${octave}`, 4, y + 2);
      }
    }
    
    // Draw vertical lines (beats)
    const beatsPerMeasure = 4;
    const measures = Math.ceil(steps / beatsPerMeasure);
    
    for (let i = 0; i <= steps; i++) {
      const x = i * STEP_WIDTH;
      const isMeasure = i % beatsPerMeasure === 0;
      
      ctx.strokeStyle = isMeasure ? '#3a3a3a' : '#2a2a2a';
      ctx.lineWidth = isMeasure ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Draw beat numbers
      if (isMeasure) {
        const measureNum = Math.floor(i / beatsPerMeasure) + 1;
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textBaseline = 'top';
        ctx.fillText(measureNum.toString(), x + 4, 2);
      }
    }
    
    // Draw playhead
    if (isPlaying) {
      const x = currentStep * STEP_WIDTH;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }
  
  function drawNotes() {
    if (!ctx) return;
    
    notes.forEach((note) => {
      const [pitch, octave] = [note.pitch.slice(0, -1), parseInt(note.pitch.slice(-1))];
      const noteIndex = PITCHES.indexOf(pitch) + (octave - OCTAVES[0]) * 12;
      const x = note.start * STEP_WIDTH;
      const y = noteIndex * NOTE_HEIGHT;
      const width = note.duration * STEP_WIDTH;
      
      // Draw note
      const isSelected = currentNote?.id === note.id;
      ctx.fillStyle = isSelected ? '#4a9ff5' : '#6366f1';
      ctx.fillRect(x, y, width, NOTE_HEIGHT - 1);
      
      // Draw border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, NOTE_HEIGHT - 1);
      
      // Draw note name for longer notes
      if (width > 20) {
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(note.pitch, x + width / 2, y + NOTE_HEIGHT / 2);
      }
    });
  }
  
  function render() {
    if (!ctx) return;
    drawGrid();
    drawNotes();
  }
  
  function getNoteAtPosition(x: number, y: number) {
    const step = Math.floor(x / STEP_WIDTH);
    const pitchIndex = Math.floor(y / NOTE_HEIGHT);
    
    if (pitchIndex < 0 || pitchIndex >= PITCHES.length * OCTAVES.length) {
      return null;
    }
    
    const octave = Math.floor(pitchIndex / 12) + OCTAVES[0];
    const noteName = PITCHES[pitchIndex % 12];
    const pitch = `${noteName}${octave}`;
    
    // Check if there's a note at this position
    const existingNote = notes.find(note => {
      const notePitchIndex = PITCHES.indexOf(note.pitch.slice(0, -1)) + 
                           (parseInt(note.pitch.slice(-1)) - OCTAVES[0]) * 12;
      const noteX = note.start * STEP_WIDTH;
      const noteWidth = note.duration * STEP_WIDTH;
      
      return (
        notePitchIndex === pitchIndex &&
        step >= note.start &&
        step < note.start + note.duration
      );
    });
    
    return { step, pitch, existingNote };
  }
  
  function handleMouseDown(e: MouseEvent) {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const result = getNoteAtPosition(x, y);
    if (!result) return;
    
    const { step, pitch, existingNote } = result;
    
    if (existingNote) {
      // Start dragging or resizing existing note
      const noteX = existingNote.start * STEP_WIDTH;
      const noteWidth = existingNote.duration * STEP_WIDTH;
      
      // Check if we're resizing (within 5px of the right edge)
      if (x > noteX + noteWidth - 10) {
        resizingNote = { id: existingNote.id, startX: x };
      } else {
        // Start dragging
        currentNote = { ...existingNote, offsetX: x - noteX, offsetY: y };
      }
    } else {
      // Create a new note
      const newNote = {
        id: `note-${Date.now()}`,
        pitch,
        start: step,
        duration: 1,
        velocity: 0.8,
        instrument: selectedInstrument
      };
      
      onNoteAdd(newNote);
      currentNote = newNote;
      
      // Play the note
      audioEngine.playNote(pitch, '8n', selectedInstrument);
    }
    
    isMouseDown = true;
    e.preventDefault();
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isMouseDown || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (resizingNote) {
      // Resize the note
      const note = notes.find(n => n.id === resizingNote.id);
      if (note) {
        const newDuration = Math.max(1, note.duration + (x - resizingNote.startX) / STEP_WIDTH);
        onNoteUpdate(note.id, { duration: Math.round(newDuration * 4) / 4 }); // Snap to quarter steps
        resizingNote.startX = x;
      }
    } else if (currentNote) {
      // Move the note
      const result = getNoteAtPosition(x, y);
      if (!result) return;
      
      const { step, pitch } = result;
      
      onNoteUpdate(currentNote.id, {
        start: Math.max(0, step - Math.floor(currentNote.offsetX / STEP_WIDTH)),
        pitch: currentNote.pitch === pitch ? currentNote.pitch : pitch,
        instrument: selectedInstrument
      });
      
      // If pitch changed, play the new note
      if (currentNote.pitch !== pitch) {
        audioEngine.playNote(pitch, '8n', selectedInstrument);
      }
    }
    
    render();
  }
  
  function handleMouseUp() {
    isMouseDown = false;
    resizingNote = null;
    currentNote = null;
  }
  
  function handleDoubleClick(e: MouseEvent) {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const result = getNoteAtPosition(x, y);
    if (!result) return;
    
    const { existingNote } = result;
    
    // Delete the note on double-click
    if (existingNote) {
      onNoteUpdate(existingNote.id, { deleted: true });
    }
  }
  
  // Update when notes or currentStep changes
  $: if (notes || currentStep !== undefined) {
    render();
  }
</script>

<div class="piano-roll" bind:this={container}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .piano-roll {
    width: 100%;
    height: 100%;
    overflow: auto;
    background: #1a1a1a;
    position: relative;
  }
  
  canvas {
    display: block;
    image-rendering: pixelated;
  }
</style>
