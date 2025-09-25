<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PianoRoll from '$lib/components/PianoRoll.svelte';
  import { audioEngine } from '$lib/audio/RealisticAudioEngine';
  
  // State
  let notes = [];
  let currentStep = 0;
  let isPlaying = false;
  let bpm = 120;
  let selectedInstrument = 'piano';
  let volume = 80;
  let isMuted = false;
  
  // Available instruments
  const instruments = [
    { id: 'piano', name: 'Piano' },
    { id: 'guitar', name: 'Guitar' },
    { id: 'bass', name: 'Bass' },
    { id: 'synth', name: 'Synth' },
    { id: 'strings', name: 'Strings' },
    { id: 'drums', name: 'Drums' }
  ];
  
  // Initialize audio engine
  onMount(async () => {
    await audioEngine.initialize();
    audioEngine.setBPM(bpm);
    
    // Set up transport loop
    const loop = audioEngine.createLoop(handleTransport, '16n');
    
    return () => {
      audioEngine.stopPlayback();
      audioEngine.dispose();
    };
  });
  
  // Transport handler
  function handleTransport(time: number) {
    // Play notes for current step
    const currentNotes = notes.filter(note => Math.floor(note.start) === currentStep);
    
    currentNotes.forEach(note => {
      audioEngine.playNote(note.pitch, '8n', note.instrument || selectedInstrument, note.velocity);
    });
    
    // Move to next step
    currentStep = (currentStep + 1) % 16;
  }
  
  // Playback control
  async function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
    } else {
      await startPlayback();
    }
  }
  
  async function startPlayback() {
    if (isPlaying) return;
    
    await audioEngine.startPlayback();
    isPlaying = true;
  }
  
  function stopPlayback() {
    audioEngine.stopPlayback();
    isPlaying = false;
    currentStep = 0;
  }
  
  // Note management
  function handleNoteAdd(note: any) {
    notes = [...notes, note];
  }
  
  function handleNoteUpdate(id: string, changes: any) {
    if (changes.deleted) {
      notes = notes.filter(note => note.id !== id);
    } else {
      notes = notes.map(note => 
        note.id === id ? { ...note, ...changes } : note
      );
    }
  }
  
  // BPM control
  function handleBPMChange(e: Event) {
    const newBPM = parseInt((e.target as HTMLInputElement).value);
    if (!isNaN(newBPM) && newBPM >= 40 && newBPM <= 300) {
      bpm = newBPM;
      audioEngine.setBPM(bpm);
    }
  }
  
  // Volume control
  function handleVolumeChange(e: Event) {
    const newVolume = parseInt((e.target as HTMLInputElement).value);
    if (!isNaN(newVolume) && newVolume >= 0 && newVolume <= 100) {
      volume = newVolume;
      // Update master volume in audio engine
      Tone.Destination.volume.value = (volume / 100) * 0.8 - 0.8; // Convert to dB
    }
  }
  
  function toggleMute() {
    isMuted = !isMuted;
    Tone.Destination.mute = isMuted;
  }
  
  // Clear all notes
  function clearAll() {
    if (confirm('Are you sure you want to clear all notes?')) {
      notes = [];
    }
  }
</script>

<div class="melody-composer">
  <header class="toolbar">
    <div class="controls">
      <button class="play-button" on:click={togglePlayback}>
        {#if isPlaying}
          ⏹️ Stop
        {:else}
          ▶️ Play
        {/if}
      </button>
      
      <div class="control-group">
        <label for="bpm">BPM:</label>
        <input 
          type="number" 
          id="bpm"
          min="40" 
          max="300" 
          bind:value={bpm} 
          on:change={handleBPMChange}
        />
      </div>
      
      <div class="control-group">
        <label for="instrument">Instrument:</label>
        <select id="instrument" bind:value={selectedInstrument}>
          {#each instruments as instrument}
            <option value={instrument.id}>{instrument.name}</option>
          {/each}
        </select>
      </div>
      
      <div class="control-group volume">
        <button class="mute-button" on:click={toggleMute}>
          {isMuted ? '🔇' : '🔊'}
        </button>
        <input 
          type="range" 
          min="0" 
          max="100" 
          bind:value={volume} 
          on:input={handleVolumeChange}
        />
      </div>
      
      <button class="clear-button" on:click={clearAll}>
        🗑️ Clear
      </button>
    </div>
  </header>
  
  <main class="editor">
    <PianoRoll
      {notes}
      {currentStep}
      {isPlaying}
      {selectedInstrument}
      on:noteAdd={handleNoteAdd}
      on:noteUpdate={handleNoteUpdate}
    />
  </main>
  
  <footer class="status-bar">
    <div class="status-item">Step: {currentStep + 1}/16</div>
    <div class="status-item">Notes: {notes.length}</div>
    <div class="status-item">{bpm} BPM</div>
  </footer>
</div>

<style>
  .melody-composer {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #1e1e1e;
    color: #f0f0f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  
  .toolbar {
    padding: 0.5rem 1rem;
    background: #2a2a2a;
    border-bottom: 1px solid #3a3a3a;
  }
  
  .controls {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  
  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .volume {
    margin-left: auto;
  }
  
  button {
    background: #3a3a3a;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.2s;
  }
  
  button:hover {
    background: #4a4a4a;
  }
  
  .play-button {
    background: #4CAF50;
    font-weight: bold;
  }
  
  .play-button:hover {
    background: #45a049;
  }
  
  .clear-button {
    background: #f44336;
  }
  
  .clear-button:hover {
    background: #d32f2f;
  }
  
  .mute-button {
    background: transparent;
    padding: 0.5rem;
    font-size: 1.2rem;
  }
  
  input[type="number"],
  select {
    background: #2a2a2a;
    color: white;
    border: 1px solid #3a3a3a;
    border-radius: 4px;
    padding: 0.3rem 0.5rem;
    width: 80px;
  }
  
  input[type="range"] {
    width: 100px;
  }
  
  .editor {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  
  .status-bar {
    display: flex;
    padding: 0.3rem 1rem;
    background: #2a2a2a;
    border-top: 1px solid #3a3a3a;
    font-size: 0.8rem;
    color: #999;
  }
  
  .status-item {
    margin-right: 1.5rem;
  }
  
  label {
    font-size: 0.9rem;
    color: #bbb;
  }
</style>
