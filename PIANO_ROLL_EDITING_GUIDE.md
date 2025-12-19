# Piano Roll Editing Improvements
**CodedSwitch Studio - Enhancement Guide**

---

## Current State
Piano roll displays notes visually but lacks interactive editing. See `PianoRollPreview.tsx` for visual implementation.

---

## 🎯 Improvement Tasks

### Task 1: Drag to Lengthen Notes
**Current**: Static note duration  
**Goal**: Click + drag right edge of note to extend/shorten

**Implementation**:
```typescript
// In PianoRollPreview.tsx, add to note rect:
const handleMouseDown = (e: React.MouseEvent, note: PianoRollNote) => {
  if (Math.abs(e.clientX - (x + width)) < 10) { // Near right edge
    const startX = e.clientX;
    const originalDuration = note.duration;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientX - startX) / PIXELS_PER_SECOND;
      const newDuration = Math.max(0.125, originalDuration + delta);
      onNotesChange?.(notes.map(n => 
        n.id === note.id ? { ...n, duration: newDuration } : n
      ));
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', onMouseMove);
    });
  }
};
```

**Effort**: 1-2 hours | **Impact**: High

---

### Task 2: Double-Click to Delete Note
**Current**: Batch delete via Clear button  
**Goal**: Double-click note to remove instantly

**Implementation**:
```typescript
// Add to note rect:
onDoubleClick={() => {
  onNotesChange?.(notes.filter(n => n.id !== note.id));
}}
```

**Effort**: 30 minutes | **Impact**: Medium

---

### Task 3: Play Note at Full Duration
**Current**: Notes stop at beat boundary  
**Goal**: Hold Note → plays for full duration (or user releases)

**Implementation**:
```typescript
// Add to note rect:
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button === 0 && !isRightEdge) { // Left click, not resize
    const { note: noteName, octave } = midiToNote(note.pitch);
    playNote?.(noteName, octave, note.duration, 'piano', 0.8, true);
    // Note plays for full `note.duration` seconds
  }
};
```

**Effort**: 30 minutes | **Impact**: Medium

---

### Task 4: Drag to Move Notes
**Current**: Fixed positions  
**Goal**: Click + drag note body to move horizontally (start time)

**Implementation**:
```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button === 0 && !isRightEdge) { // Left click, not resize edge
    const startX = e.clientX;
    const originalStart = note.start;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientX - startX) / PIXELS_PER_SECOND;
      const newStart = Math.max(0, originalStart + delta);
      onNotesChange?.(notes.map(n =>
        n.id === note.id ? { ...n, start: newStart } : n
      ));
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', onMouseMove);
    });
  }
};
```

**Effort**: 1-2 hours | **Impact**: High

---

### Task 5: Drag to Move Vertically (Change Pitch)
**Current**: Fixed pitch  
**Goal**: Drag note up/down to change pitch (semitone snapping)

**Implementation**:
```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  const startY = e.clientY;
  const originalPitch = note.pitch;
  
  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaY = (moveEvent.clientY - startY) / NOTE_HEIGHT;
    const pitchDelta = Math.round(-deltaY); // Negative: drag up = higher pitch
    const newPitch = Math.max(0, Math.min(127, originalPitch + pitchDelta));
    onNotesChange?.(notes.map(n =>
      n.id === note.id ? { ...n, pitch: newPitch } : n
    ));
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', () => {
    document.removeEventListener('mousemove', onMouseMove);
  });
};
```

**Effort**: 1-2 hours | **Impact**: High

---

### Task 6: Velocity Slider on Hover
**Current**: Opacity shows velocity visually  
**Goal**: Hover note → slider appears to adjust velocity (0-127)

**Implementation**:
```typescript
// Show on hover:
{isHovered && (
  <foreignObject x={x} y={y - 20} width={width} height={20}>
    <input
      type="range"
      min="0"
      max="127"
      value={note.velocity || 80}
      onChange={(e) => {
        onNotesChange?.(notes.map(n =>
          n.id === note.id ? { ...n, velocity: parseInt(e.target.value) } : n
        ));
      }}
    />
  </foreignObject>
)}
```

**Effort**: 1 hour | **Impact**: Medium

---

### Task 7: Snap to Grid Toggle
**Current**: Free positioning  
**Goal**: Toggle snap-to-grid (snap to sixteenth notes, eighth notes, etc.)

**Implementation**:
```typescript
const snapToGrid = (value: number, gridSize: number) => {
  return Math.round(value / gridSize) * gridSize;
};

// When dragging:
const newStart = snapToGrid(originalStart + delta, 0.125); // 16th note snapping
```

**Effort**: 1 hour | **Impact**: Medium

---

### Task 8: Right-Click Context Menu
**Current**: No context menu  
**Goal**: Right-click note → delete/duplicate/transpose options

**Implementation**:
```typescript
const handleContextMenu = (e: React.MouseEvent, note: PianoRollNote) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, noteId: note.id });
};

// Show menu:
{contextMenu && (
  <ContextMenu x={contextMenu.x} y={contextMenu.y}>
    <MenuItem onClick={() => deleteNote(contextMenu.noteId)}>Delete</MenuItem>
    <MenuItem onClick={() => duplicateNote(contextMenu.noteId)}>Duplicate</MenuItem>
    <MenuItem onClick={() => transposeNote(contextMenu.noteId, 12)}>Octave Up</MenuItem>
    <MenuItem onClick={() => transposeNote(contextMenu.noteId, -12)}>Octave Down</MenuItem>
  </ContextMenu>
)}
```

**Effort**: 2 hours | **Impact**: High

---

### Task 9: Select Multiple Notes
**Current**: Single note interaction  
**Goal**: Click + drag to select multiple notes (rectangle selection)

**Implementation**:
```typescript
const [selectionBox, setSelectionBox] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);

const handleMouseDown = (e: React.MouseEvent) => {
  if (!isNote) { // Clicked on canvas, not a note
    setSelectionBox({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
  }
};

// Check which notes fall within selection box
const selectedNotes = notes.filter(n => {
  const noteX = n.start * PIXELS_PER_SECOND;
  const noteY = (metrics.renderMaxPitch - n.pitch) * NOTE_HEIGHT;
  return noteX > selectionBox.x1 && noteX < selectionBox.x2 &&
         noteY > selectionBox.y1 && noteY < selectionBox.y2;
});
```

**Effort**: 2-3 hours | **Impact**: High

---

### Task 10: Keyboard Shortcuts
**Current**: Mouse-only  
**Goal**: Keyboard shortcuts for faster editing

**Shortcuts**:
```
Delete: Selected notes → Delete key
Duplicate: Ctrl+D / Cmd+D
Octave Up: Ctrl+Up / Cmd+Up
Octave Down: Ctrl+Down / Cmd+Down
Play: Spacebar
Undo: Ctrl+Z / Cmd+Z
Snap Toggle: S key
Quantize: Q key
```

**Effort**: 1-2 hours | **Impact**: Medium

---

## 📋 Implementation Priority

| Task | Priority | Effort | ROI | Timeline |
|------|----------|--------|-----|----------|
| Drag to lengthen | HIGH | 2h | High | Week 1 |
| Double-click delete | HIGH | 0.5h | Medium | Week 1 |
| Play full duration | HIGH | 0.5h | Medium | Week 1 |
| Drag to move (X) | MEDIUM | 2h | High | Week 2 |
| Drag to move (Y/pitch) | MEDIUM | 2h | High | Week 2 |
| Velocity slider | MEDIUM | 1h | Low | Week 2 |
| Snap to grid | MEDIUM | 1h | Medium | Week 2 |
| Context menu | MEDIUM | 2h | Medium | Week 3 |
| Multi-select | LOW | 3h | High | Week 3 |
| Keyboard shortcuts | LOW | 2h | Medium | Week 3 |

---

## Quick Start

**Week 1 (3 tasks, 3 hours)**:
1. Add drag-to-lengthen to right edge detection
2. Add double-click delete listener
3. Enhance playNote to use full duration

**Week 2 (5 tasks, 7 hours)**:
4. Add drag-to-move-X with position tracking
5. Add drag-to-move-Y with pitch snapping
6. Add hover velocity slider
7. Add snap-to-grid toggle + quantize button
8. Start context menu foundation

These are sequential improvements to `PianoRollPreview.tsx` - each builds on previous interactions.
