/**
 * Virtual Music Studio - Professional DAW Piano Roll & MIDI Editor
 * Complete sequencing engine: Multi-octave piano keyboard, musical time ruler,
 * grid snapping (1/4 to 1/32 + triplets), note creation/move/resize, marquee selection,
 * velocity lane editor, scale highlighting, undo/redo history, and real-time playback sync.
 */

class PianoRoll {
  constructor() {
    this.currentTrack = null;
    this.modalEl = null;
    this.gridEl = null;
    this.keyboardGutterEl = null;
    this.rulerEl = null;
    this.velocityLaneEl = null;
    this.velocityBarsEl = null;
    this.playheadEl = null;

    // Display & Zoom parameters
    this.pixelsPerBeat = 64; // Horizontal zoom (24px to 160px)
    this.keyHeight = 20;      // Vertical zoom (14px to 32px)
    this.startNote = 24;      // C1
    this.endNote = 96;        // C7 (73 semitones / 6 full octaves)
    this.totalBeats = 64;     // 16 bars of 4/4 default

    // Snapping & Musical state
    this.snapBeats = 0.25;    // 1/16th note default
    this.scaleRoot = 'C';
    this.scaleType = 'off';   // 'off', 'major', 'minor', 'pentatonic_major', 'blues', etc.
    this.activeTool = 'select'; // 'select', 'pencil', 'eraser'
    this.showVelocityLane = true;
    this.isOpen = false;

    // Multi-Selection & Clipboard
    this.selectedNoteIds = new Set();
    this.clipboard = [];

    // History (Undo / Redo)
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 40;

    // Interaction states
    this.dragAction = null; // 'move', 'resize', 'marquee', 'velocity', 'scrub'
    this.dragStart = { x: 0, y: 0 };
    this.marqueeRect = null;
    this.draggedNotesInitial = [];
    this.animationFrameId = null;

    // Note names
    this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  }

  init() {
    this.modalEl = document.getElementById('piano-roll-modal');
    this._buildModalDOM();
    this._bindEvents();
    this._bindKeyboardShortcuts();
    console.log('[PianoRoll] Professional DAW MIDI Editor initialized.');
  }

  /**
   * Builds the rich DAW interface elements inside the modal
   */
  _buildModalDOM() {
    if (!this.modalEl) return;
    const modalContent = this.modalEl.querySelector('.modal-content');
    if (!modalContent) return;

    modalContent.innerHTML = `
      <!-- Piano Roll Header & Top Toolbar -->
      <div class="roll-toolbar-header">
        <div class="roll-track-info">
          <div class="roll-track-color" id="roll-track-color-badge"></div>
          <div>
            <h2 id="piano-roll-track-title" class="roll-title">Piano Roll: Track</h2>
            <div class="roll-meta-info" id="roll-meta-info">Instrument: Piano • 4/4</div>
          </div>
        </div>

        <!-- Transport Controls -->
        <div class="roll-transport-group">
          <button class="btn btn-sm btn-transport" id="roll-play-btn" title="Play / Pause [Space]">▶ Play</button>
          <button class="btn btn-sm btn-transport" id="roll-stop-btn" title="Stop & Rewind">■</button>
          <button class="btn btn-sm btn-ghost" id="roll-loop-btn" title="Toggle Loop Region">🔁 Loop</button>
          <div class="roll-timecode" id="roll-timecode-display">01.1.00</div>
        </div>

        <!-- Snap & Quantize -->
        <div class="roll-tool-group">
          <label>SNAP:</label>
          <select id="roll-snap-select" class="roll-select" title="Grid Snapping">
            <option value="1">1/4 Note</option>
            <option value="0.5">1/8 Note</option>
            <option value="0.25" selected>1/16 Note</option>
            <option value="0.125">1/32 Note</option>
            <option value="0.333333">1/8 Triplet</option>
            <option value="0.166667">1/16 Triplet</option>
            <option value="0">Off (Free)</option>
          </select>
          <button class="btn btn-sm btn-secondary" id="piano-roll-quantize-btn" title="Quantize selected notes to grid">⚡ Quantize</button>
        </div>

        <!-- Scale Highlighting -->
        <div class="roll-tool-group">
          <label>SCALE:</label>
          <select id="roll-scale-root-select" class="roll-select" style="width: 50px;">
            <option value="C">C</option><option value="C#">C#</option><option value="D">D</option>
            <option value="D#">D#</option><option value="E">E</option><option value="F">F</option>
            <option value="F#">F#</option><option value="G">G</option><option value="G#">G#</option>
            <option value="A">A</option><option value="A#">A#</option><option value="B">B</option>
          </select>
          <select id="roll-scale-type-select" class="roll-select" style="width: 90px;">
            <option value="off">Off</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="pentatonic_major">Penta Maj</option>
            <option value="pentatonic_minor">Penta Min</option>
            <option value="blues">Blues</option>
            <option value="spanish_gypsy">Flamenco</option>
            <option value="raga_bhairav">Bhairav</option>
          </select>
        </div>

        <!-- Tools: Select, Pencil, Eraser -->
        <div class="roll-tool-buttons">
          <button class="btn btn-sm btn-ghost roll-tool-btn active" data-tool="select" title="Select / Move Tool [V]">↖</button>
          <button class="btn btn-sm btn-ghost roll-tool-btn" data-tool="pencil" title="Pencil / Draw Tool [B]">✏</button>
          <button class="btn btn-sm btn-ghost roll-tool-btn" data-tool="eraser" title="Eraser Tool [E]">⌫</button>
        </div>

        <!-- Actions: Undo, Redo, Zoom, Close -->
        <div class="roll-actions-group">
          <button class="btn btn-sm btn-ghost" id="roll-undo-btn" title="Undo [Ctrl+Z]">↶</button>
          <button class="btn btn-sm btn-ghost" id="roll-redo-btn" title="Redo [Ctrl+Y]">↷</button>
          <button class="btn btn-sm btn-ghost" id="roll-duplicate-btn" title="Duplicate Notes [Ctrl+D]">⧉</button>
          <button class="btn btn-sm btn-ghost" id="roll-humanize-btn" title="Humanize Timing & Velocity">✨ Humanize</button>
          
          <!-- Zoom Controls -->
          <button class="btn btn-sm btn-ghost" id="roll-zoom-out-btn" title="Zoom Out Horizonally">🔍−</button>
          <button class="btn btn-sm btn-ghost" id="roll-zoom-in-btn" title="Zoom In Horizontally">🔍+</button>
          
          <!-- Velocity Toggle -->
          <button class="btn btn-sm btn-ghost active" id="roll-toggle-velocity-btn" title="Toggle Velocity Lane">📊</button>

          <!-- MIDI Import/Export -->
          <button class="btn btn-sm btn-ghost" id="roll-export-midi-btn" title="Export this track as Standard MIDI">⬇ MIDI</button>
          <label class="btn btn-sm btn-ghost" style="cursor: pointer;" title="Import Standard MIDI File (.mid)">
            ⬆ Import
            <input type="file" id="roll-import-midi-input" accept=".mid,.midi" style="display: none;" />
          </label>

          <button class="modal-close-btn" id="close-piano-roll-btn" title="Close [Esc]">✕</button>
        </div>
      </div>

      <!-- Quick Info Bar -->
      <div class="roll-quick-tips">
        <span>Click empty cell to draw note • Drag to move • Drag right edge to resize • Double-click or Del to delete • Shift+Click or Marquee to select multiple</span>
      </div>

      <!-- Main Editor Container (Timeline Ruler + Body + Velocity Lane) -->
      <div class="piano-roll-main-workspace">
        
        <!-- Top Timeline Ruler -->
        <div class="roll-ruler-container" id="roll-ruler-container">
          <div class="roll-ruler-spacer">KEY / TIMELINE</div>
          <div class="roll-ruler-scroll" id="roll-ruler-scroll">
            <div class="roll-ruler-track" id="roll-ruler-track"></div>
          </div>
        </div>

        <!-- Middle Body: Piano Keys Gutter + Notes Matrix Grid -->
        <div class="piano-roll-body" id="piano-roll-body">
          <div class="piano-roll-keys-gutter" id="piano-roll-keys-gutter"></div>
          <div class="piano-roll-grid-scroll" id="piano-roll-grid-scroll">
            <div class="piano-roll-grid" id="piano-roll-grid">
              <!-- Playhead Line -->
              <div class="roll-playhead-line" id="roll-playhead-line"></div>
              <!-- Selection Marquee Box -->
              <div class="roll-selection-marquee" id="roll-selection-marquee"></div>
            </div>
          </div>
        </div>

        <!-- Bottom Velocity Lane -->
        <div class="roll-velocity-lane-container" id="roll-velocity-lane-container">
          <div class="roll-velocity-gutter">
            <span>127</span>
            <span>96</span>
            <span>64</span>
            <span>32</span>
            <span>0</span>
          </div>
          <div class="roll-velocity-scroll" id="roll-velocity-scroll">
            <div class="roll-velocity-bars" id="roll-velocity-bars"></div>
          </div>
        </div>

      </div>
    `;

    // Cache elements
    this.gridEl = document.getElementById('piano-roll-grid');
    this.keyboardGutterEl = document.getElementById('piano-roll-keys-gutter');
    this.rulerEl = document.getElementById('roll-ruler-track');
    this.velocityLaneEl = document.getElementById('roll-velocity-lane-container');
    this.velocityBarsEl = document.getElementById('roll-velocity-bars');
    this.playheadEl = document.getElementById('roll-playhead-line');
  }

  /**
   * Opens the Piano Roll for a specific instrument track
   */
  openTrack(track) {
    if (!track) return;
    if (!track.events) track.events = track.notes || [];
    this.currentTrack = track;
    this.isOpen = true;
    this.selectedNoteIds.clear();
    this.undoStack = [];
    this.redoStack = [];

    if (this.modalEl) {
      this.modalEl.classList.add('open');

      // Update Track Info & Badges
      const titleEl = document.getElementById('piano-roll-track-title');
      const metaEl = document.getElementById('roll-meta-info');
      const colorBadge = document.getElementById('roll-track-color-badge');
      const inst = window.instrumentManager ? window.instrumentManager.getInstrument(track.instrumentId) : null;

      if (titleEl) titleEl.textContent = `Piano Roll: ${track.name}`;
      if (metaEl) metaEl.textContent = `Instrument: ${inst ? inst.name : track.instrumentId} • ${track.events.length} notes`;
      if (colorBadge) colorBadge.style.backgroundColor = track.color || '#8B5CF6';

      this.render();

      // Scroll to central octave (around C4 = midi 60)
      this._scrollKeysToNote(60);

      // Start playhead sync animation
      this._startPlayheadAnimation();
    }
  }

  close() {
    this.isOpen = false;
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (window.trackManager) {
      window.trackManager.renderArrangerUI();
    }
  }

  /**
   * Comprehensive Render Method
   */
  render() {
    if (!this.currentTrack || !this.gridEl || !this.keyboardGutterEl) return;

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;

    // Calculate maximum length needed
    let maxMs = 16000;
    this.currentTrack.events.forEach(ev => {
      const end = (ev.startTimeMs || 0) + (ev.durationMs || 500);
      if (end > maxMs) maxMs = end;
    });
    const calculatedBeats = Math.max(32, Math.ceil((maxMs / msPerBeat) + 8));
    this.totalBeats = Math.max(this.totalBeats, calculatedBeats);

    const totalNotes = this.endNote - this.startNote + 1;
    const gridWidth = this.totalBeats * this.pixelsPerBeat;
    const gridHeight = totalNotes * this.keyHeight;

    // Set dimensions
    this.gridEl.style.width = `${gridWidth}px`;
    this.gridEl.style.height = `${gridHeight}px`;

    const rulerScroll = document.getElementById('roll-ruler-track');
    if (rulerScroll) rulerScroll.style.width = `${gridWidth}px`;

    if (this.velocityBarsEl) {
      this.velocityBarsEl.style.width = `${gridWidth}px`;
    }

    // 1. Render Timeline Ruler
    this._renderTimelineRuler();

    // 2. Render Vertical Piano Keys Gutter
    this._renderKeyboardGutter();

    // 3. Render Horizontal & Vertical Grid Lines
    this._renderGridMatrix(gridWidth, gridHeight);

    // 4. Render Note Blocks
    this._renderNoteBlocks(msPerBeat);

    // 5. Render Velocity Lane Bars
    this._renderVelocityBars(msPerBeat);

    // 6. Update Transport & Meta UI
    this._updateTransportUI();
  }

  _renderTimelineRuler() {
    if (!this.rulerEl) return;
    this.rulerEl.innerHTML = '';

    for (let b = 0; b < this.totalBeats; b++) {
      const leftPx = b * this.pixelsPerBeat;
      const tick = document.createElement('div');
      const isBar = b % 4 === 0;
      tick.className = `ruler-tick ${isBar ? 'bar-tick' : 'beat-tick'}`;
      tick.style.left = `${leftPx}px`;

      if (isBar) {
        const barNum = (b / 4) + 1;
        tick.innerHTML = `<span class="ruler-bar-num">${barNum}</span>`;
      }
      this.rulerEl.appendChild(tick);
    }
  }

  _renderKeyboardGutter() {
    if (!this.keyboardGutterEl) return;
    this.keyboardGutterEl.innerHTML = '';

    const rootSemi = this._getRootSemitone(this.scaleRoot);
    const inScaleSet = this._getInScaleSemitones();

    for (let midi = this.endNote; midi >= this.startNote; midi--) {
      const noteInfo = window.noteMapper.getNoteInfoFromMidi(midi);
      const isRoot = (midi % 12) === rootSemi;
      const isInScale = this.scaleType !== 'off' && inScaleSet.has(midi % 12);

      const keyRow = document.createElement('div');
      keyRow.className = `roll-key ${noteInfo.isBlack ? 'black-key' : 'white-key'} ${isRoot ? 'root-key' : ''} ${isInScale ? 'scale-key' : ''}`;
      keyRow.style.height = `${this.keyHeight}px`;
      keyRow.dataset.midi = midi;

      keyRow.innerHTML = `
        <span class="key-name">${noteInfo.pitchName === 'C' || isRoot ? noteInfo.noteName : noteInfo.pitchName}</span>
      `;

      // Audition note on click/press
      keyRow.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._auditionNote(midi);
      });

      this.keyboardGutterEl.appendChild(keyRow);
    }
  }

  _renderGridMatrix(gridWidth, gridHeight) {
    // Retain playhead and marquee elements
    const playhead = this.playheadEl;
    const marquee = document.getElementById('roll-selection-marquee');
    this.gridEl.innerHTML = '';
    if (playhead) this.gridEl.appendChild(playhead);
    if (marquee) this.gridEl.appendChild(marquee);

    const inScaleSet = this._getInScaleSemitones();

    // Horizontal pitch lane rows
    for (let midi = this.endNote; midi >= this.startNote; midi--) {
      const noteInfo = window.noteMapper.getNoteInfoFromMidi(midi);
      const isInScale = this.scaleType !== 'off' && inScaleSet.has(midi % 12);

      const row = document.createElement('div');
      row.className = `roll-grid-row ${noteInfo.isBlack ? 'black-row' : 'white-row'} ${isInScale ? 'in-scale-row' : ''}`;
      row.style.height = `${this.keyHeight}px`;
      row.dataset.midi = midi;
      this.gridEl.appendChild(row);
    }

    // Vertical Bar & Beat Lines
    for (let b = 0; b <= this.totalBeats; b++) {
      const line = document.createElement('div');
      const isBar = b % 4 === 0;
      line.className = `roll-vertical-line ${isBar ? 'bar-line' : 'beat-line'}`;
      line.style.left = `${b * this.pixelsPerBeat}px`;
      this.gridEl.appendChild(line);

      // Sub-beat subdivisions (16th notes)
      if (this.snapBeats <= 0.25) {
        for (let sub = 1; sub < 4; sub++) {
          const subLine = document.createElement('div');
          subLine.className = 'roll-vertical-subline';
          subLine.style.left = `${(b + sub * 0.25) * this.pixelsPerBeat}px`;
          this.gridEl.appendChild(subLine);
        }
      }
    }
  }

  _renderNoteBlocks(msPerBeat) {
    if (!this.currentTrack) return;

    this.currentTrack.events.forEach((ev) => {
      if (ev.midiNote < this.startNote || ev.midiNote > this.endNote) return;

      const rowIndex = this.endNote - ev.midiNote;
      const topPx = rowIndex * this.keyHeight;
      const beatPosition = (ev.startTimeMs || 0) / msPerBeat;
      const beatDuration = Math.max(0.125, (ev.durationMs || 300) / msPerBeat);
      const leftPx = beatPosition * this.pixelsPerBeat;
      const widthPx = Math.max(14, beatDuration * this.pixelsPerBeat);

      const isSelected = this.selectedNoteIds.has(ev.id);
      const vel = ev.velocity !== undefined ? ev.velocity : 0.85;

      const noteEl = document.createElement('div');
      noteEl.className = `roll-note-block ${isSelected ? 'selected' : ''}`;
      noteEl.dataset.noteId = ev.id;
      noteEl.style.top = `${topPx + 1}px`;
      noteEl.style.left = `${leftPx}px`;
      noteEl.style.width = `${widthPx - 2}px`;
      noteEl.style.height = `${this.keyHeight - 2}px`;

      // Visual color matching track with velocity brightness
      const baseColor = this.currentTrack.color || '#8B5CF6';
      noteEl.style.backgroundColor = baseColor;
      noteEl.style.opacity = `${0.65 + (vel * 0.35)}`;

      const noteInfo = window.noteMapper.getNoteInfoFromMidi(ev.midiNote);
      noteEl.title = `${noteInfo.noteName} • Vel: ${Math.round(vel * 127)} • Time: ${(ev.startTimeMs / 1000).toFixed(2)}s`;

      noteEl.innerHTML = `
        <span class="roll-note-name">${noteInfo.noteName}</span>
        <div class="roll-note-resize-handle" title="Drag to resize duration"></div>
      `;

      // Event handlers for drag & resize
      this._bindNoteInteractions(noteEl, ev);

      this.gridEl.appendChild(noteEl);
    });
  }

  _renderVelocityBars(msPerBeat) {
    if (!this.velocityBarsEl || !this.showVelocityLane) return;
    this.velocityBarsEl.innerHTML = '';

    const laneHeight = 80;

    this.currentTrack.events.forEach((ev) => {
      const beatPosition = (ev.startTimeMs || 0) / msPerBeat;
      const leftPx = beatPosition * this.pixelsPerBeat;
      const vel = ev.velocity !== undefined ? ev.velocity : 0.85;
      const barHeight = Math.max(6, vel * laneHeight);
      const isSelected = this.selectedNoteIds.has(ev.id);

      const bar = document.createElement('div');
      bar.className = `roll-vel-bar ${isSelected ? 'selected' : ''}`;
      bar.dataset.noteId = ev.id;
      bar.style.left = `${leftPx}px`;
      bar.style.height = `${barHeight}px`;
      bar.innerHTML = `<div class="roll-vel-handle" title="Velocity: ${Math.round(vel * 127)}"></div>`;

      // Drag velocity
      const handle = bar.querySelector('.roll-vel-handle');
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._startVelocityDrag(e, ev);
      });

      this.velocityBarsEl.appendChild(bar);
    });
  }

  /**
   * Note Block Interactions (Click, Move, Resize, Delete)
   */
  _bindNoteInteractions(noteEl, ev) {
    const resizeHandle = noteEl.querySelector('.roll-note-resize-handle');

    // Double-click to delete
    noteEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this._saveHistoryState();
      this.deleteNote(ev.id);
    });

    // Right-click context delete
    noteEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._saveHistoryState();
      this.deleteNote(ev.id);
    });

    // Resize dragging
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._startNoteResize(e, ev);
      });
    }

    // Move dragging / selection
    noteEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('roll-note-resize-handle')) return;
      e.stopPropagation();

      // Tool handling
      if (this.activeTool === 'eraser') {
        this._saveHistoryState();
        this.deleteNote(ev.id);
        return;
      }

      // Selection handling (Shift adds to selection)
      if (e.shiftKey) {
        if (this.selectedNoteIds.has(ev.id)) {
          this.selectedNoteIds.delete(ev.id);
        } else {
          this.selectedNoteIds.add(ev.id);
        }
        this._updateSelectionVisuals();
      } else if (!this.selectedNoteIds.has(ev.id)) {
        this.selectedNoteIds.clear();
        this.selectedNoteIds.add(ev.id);
        this._updateSelectionVisuals();
      }

      this._auditionNote(ev.midiNote);
      this._startNoteMove(e, ev);
    });
  }

  _startNoteMove(e, primaryEv) {
    this._saveHistoryState();
    this.dragAction = 'move';
    this.dragStart = { x: e.clientX, y: e.clientY };

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;

    // Snapshot selected notes
    const selected = this.currentTrack.events.filter(ev => this.selectedNoteIds.has(ev.id));
    this.draggedNotesInitial = selected.map(ev => ({
      id: ev.id,
      initialStartMs: ev.startTimeMs,
      initialMidi: ev.midiNote
    }));

    const onMouseMove = (moveEv) => {
      if (this.dragAction !== 'move') return;
      const deltaX = moveEv.clientX - this.dragStart.x;
      const deltaY = moveEv.clientY - this.dragStart.y;

      // Delta beats and semitones
      const deltaBeatsRaw = deltaX / this.pixelsPerBeat;
      const snap = this.snapBeats > 0 ? this.snapBeats : 0.0625;
      const deltaBeatsSnapped = Math.round(deltaBeatsRaw / snap) * snap;
      const deltaMs = deltaBeatsSnapped * msPerBeat;

      const deltaSemitones = -Math.round(deltaY / this.keyHeight);

      this.draggedNotesInitial.forEach(item => {
        const targetEv = this.currentTrack.events.find(ev => ev.id === item.id);
        if (targetEv) {
          targetEv.startTimeMs = Math.max(0, item.initialStartMs + deltaMs);
          targetEv.midiNote = Math.max(this.startNote, Math.min(this.endNote, item.initialMidi + deltaSemitones));
        }
      });

      this.render();
    };

    const onMouseUp = () => {
      this.dragAction = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (window.trackManager) window.trackManager.renderArrangerUI();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  _startNoteResize(e, targetEv) {
    this._saveHistoryState();
    this.dragAction = 'resize';
    this.dragStart = { x: e.clientX };
    const initialDuration = targetEv.durationMs || 300;
    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;

    const onMouseMove = (moveEv) => {
      if (this.dragAction !== 'resize') return;
      const deltaX = moveEv.clientX - this.dragStart.x;
      const deltaBeats = deltaX / this.pixelsPerBeat;
      const snap = this.snapBeats > 0 ? this.snapBeats : 0.0625;
      const deltaBeatsSnapped = Math.round(deltaBeats / snap) * snap;
      const deltaMs = deltaBeatsSnapped * msPerBeat;

      targetEv.durationMs = Math.max(50, initialDuration + deltaMs);
      this.render();
    };

    const onMouseUp = () => {
      this.dragAction = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (window.trackManager) window.trackManager.renderArrangerUI();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  _startVelocityDrag(e, targetEv) {
    this._saveHistoryState();
    this.dragAction = 'velocity';
    const startY = e.clientY;
    const initialVel = targetEv.velocity !== undefined ? targetEv.velocity : 0.85;

    const onMouseMove = (moveEv) => {
      if (this.dragAction !== 'velocity') return;
      const deltaY = startY - moveEv.clientY;
      const newVel = Math.max(0.05, Math.min(1.0, initialVel + (deltaY / 80)));
      
      // Update target and any selected notes
      if (this.selectedNoteIds.has(targetEv.id)) {
        this.currentTrack.events.forEach(ev => {
          if (this.selectedNoteIds.has(ev.id)) {
            ev.velocity = parseFloat(newVel.toFixed(2));
          }
        });
      } else {
        targetEv.velocity = parseFloat(newVel.toFixed(2));
      }
      this.render();
    };

    const onMouseUp = () => {
      this.dragAction = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  _startMarqueeSelection(e) {
    this.dragAction = 'marquee';
    const gridRect = this.gridEl.getBoundingClientRect();
    const startX = e.clientX - gridRect.left;
    const startY = e.clientY - gridRect.top;
    const marqueeEl = document.getElementById('roll-selection-marquee');

    if (!e.shiftKey) {
      this.selectedNoteIds.clear();
      this._updateSelectionVisuals();
    }

    const onMouseMove = (moveEv) => {
      if (this.dragAction !== 'marquee' || !marqueeEl) return;
      const currentX = moveEv.clientX - gridRect.left;
      const currentY = moveEv.clientY - gridRect.top;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      marqueeEl.style.display = 'block';
      marqueeEl.style.left = `${left}px`;
      marqueeEl.style.top = `${top}px`;
      marqueeEl.style.width = `${width}px`;
      marqueeEl.style.height = `${height}px`;

      // Check which notes intersect marquee
      const bpm = window.trackManager ? window.trackManager.bpm : 120;
      const msPerBeat = (60 / bpm) * 1000;

      this.currentTrack.events.forEach(ev => {
        const rowIndex = this.endNote - ev.midiNote;
        const noteTop = rowIndex * this.keyHeight;
        const noteLeft = (ev.startTimeMs / msPerBeat) * this.pixelsPerBeat;
        const noteWidth = ((ev.durationMs || 300) / msPerBeat) * this.pixelsPerBeat;

        const intersects = (
          left < (noteLeft + noteWidth) &&
          (left + width) > noteLeft &&
          top < (noteTop + this.keyHeight) &&
          (top + height) > noteTop
        );

        if (intersects) {
          this.selectedNoteIds.add(ev.id);
        }
      });

      this._updateSelectionVisuals();
    };

    const onMouseUp = () => {
      this.dragAction = null;
      if (marqueeEl) marqueeEl.style.display = 'none';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  _bindEvents() {
    // 1. Grid Click to Create Note or Marquee Select
    if (this.gridEl) {
      this.gridEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.roll-note-block') || e.target.closest('.roll-playhead-line')) return;

        // If select tool and clicking on empty grid, marquee select or add note
        const gridRect = this.gridEl.getBoundingClientRect();
        const clickX = e.clientX - gridRect.left;
        const clickY = e.clientY - gridRect.top;

        if (this.activeTool === 'pencil' || (this.activeTool === 'select' && e.altKey)) {
          this._createNewNoteAt(clickX, clickY);
        } else if (this.activeTool === 'select') {
          // If simple click, create note; if dragged, marquee select
          this._startMarqueeSelection(e);
        }
      });

      // Double-click empty grid space creates note in select mode
      this.gridEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.roll-note-block')) return;
        const gridRect = this.gridEl.getBoundingClientRect();
        this._createNewNoteAt(e.clientX - gridRect.left, e.clientY - gridRect.top);
      });
    }

    // 2. Timeline Ruler Scrub / Seek
    const rulerContainer = document.getElementById('roll-ruler-container');
    if (rulerContainer) {
      rulerContainer.addEventListener('mousedown', (e) => {
        const rect = this.rulerEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        this._seekFromPixel(clickX);
      });
    }

    // 3. Scroll Synchronization between Grid, Keys Gutter, Ruler, and Velocity Lane
    const gridScroll = document.getElementById('piano-roll-grid-scroll');
    const gutter = document.getElementById('piano-roll-keys-gutter');
    const rulerScroll = document.getElementById('roll-ruler-scroll');
    const velScroll = document.getElementById('roll-velocity-scroll');

    if (gridScroll) {
      gridScroll.addEventListener('scroll', () => {
        if (gutter) gutter.scrollTop = gridScroll.scrollTop;
        if (rulerScroll) rulerScroll.scrollLeft = gridScroll.scrollLeft;
        if (velScroll) velScroll.scrollLeft = gridScroll.scrollLeft;
      });
    }

    // 4. Transport Buttons
    const playBtn = document.getElementById('roll-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (window.trackManager) window.trackManager.togglePlay();
      });
    }

    const stopBtn = document.getElementById('roll-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (window.trackManager) window.trackManager.stop();
      });
    }

    const loopBtn = document.getElementById('roll-loop-btn');
    if (loopBtn) {
      loopBtn.addEventListener('click', () => {
        if (window.trackManager) {
          window.trackManager.isLooping = !window.trackManager.isLooping;
          loopBtn.classList.toggle('active', window.trackManager.isLooping);
        }
      });
    }

    // 5. Snapping Selector
    const snapSelect = document.getElementById('roll-snap-select');
    if (snapSelect) {
      snapSelect.addEventListener('change', (e) => {
        this.snapBeats = parseFloat(e.target.value);
        this.render();
      });
    }

    // 6. Scale Selector
    const scaleRootSelect = document.getElementById('roll-scale-root-select');
    const scaleTypeSelect = document.getElementById('roll-scale-type-select');
    if (scaleRootSelect && scaleTypeSelect) {
      const onScaleChange = () => {
        this.scaleRoot = scaleRootSelect.value;
        this.scaleType = scaleTypeSelect.value;
        this.render();
      };
      scaleRootSelect.addEventListener('change', onScaleChange);
      scaleTypeSelect.addEventListener('change', onScaleChange);
    }

    // 7. Tool Buttons (Select, Pencil, Eraser)
    document.querySelectorAll('.roll-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.roll-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTool = btn.dataset.tool;
      });
    });

    // 8. Actions (Undo, Redo, Duplicate, Quantize, Velocity Toggle)
    const undoBtn = document.getElementById('roll-undo-btn');
    if (undoBtn) undoBtn.addEventListener('click', () => this.undo());

    const redoBtn = document.getElementById('roll-redo-btn');
    if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

    const dupBtn = document.getElementById('roll-duplicate-btn');
    if (dupBtn) dupBtn.addEventListener('click', () => this.duplicateSelected());

    const humanizeBtn = document.getElementById('roll-humanize-btn');
    if (humanizeBtn) {
      humanizeBtn.addEventListener('click', () => {
        if (!this.currentTrack || !this.currentTrack.events || this.currentTrack.events.length === 0) return;
        this._saveHistoryState();
        const targets = this.selectedNoteIds.size > 0
          ? this.currentTrack.events.filter(e => this.selectedNoteIds.has(e.id))
          : this.currentTrack.events;

        targets.forEach(ev => {
          const timeOffset = Math.round((Math.random() * 2 - 1) * 15);
          ev.startTimeMs = Math.max(0, ev.startTimeMs + timeOffset);
          const velOffset = Math.round((Math.random() * 2 - 1) * 12);
          const currentVal = Math.round((ev.velocity || 0.8) * 127);
          ev.velocity = Math.max(1, Math.min(127, currentVal + velOffset)) / 127;
        });

        this.render();
        if (window.trackManager) window.trackManager.renderArrangerUI();
      });
    }

    const quantizeBtn = document.getElementById('piano-roll-quantize-btn');
    if (quantizeBtn) quantizeBtn.addEventListener('click', () => this.quantizeSelected());

    const velToggleBtn = document.getElementById('roll-toggle-velocity-btn');
    if (velToggleBtn) {
      velToggleBtn.addEventListener('click', () => {
        this.showVelocityLane = !this.showVelocityLane;
        velToggleBtn.classList.toggle('active', this.showVelocityLane);
        if (this.velocityLaneEl) {
          this.velocityLaneEl.style.display = this.showVelocityLane ? 'flex' : 'none';
        }
      });
    }

    // 9. Zoom Buttons
    const zoomInBtn = document.getElementById('roll-zoom-in-btn');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        this.pixelsPerBeat = Math.min(160, this.pixelsPerBeat * 1.25);
        this.render();
      });
    }

    const zoomOutBtn = document.getElementById('roll-zoom-out-btn');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        this.pixelsPerBeat = Math.max(28, this.pixelsPerBeat / 1.25);
        this.render();
      });
    }

    // 10. MIDI Import & Export
    const exportMidiBtn = document.getElementById('roll-export-midi-btn');
    if (exportMidiBtn) {
      exportMidiBtn.addEventListener('click', () => {
        if (window.exportManager) {
          if (this.currentTrack && typeof window.exportManager.exportTrackAsMidi === 'function') {
            window.exportManager.exportTrackAsMidi(this.currentTrack);
          } else {
            window.exportManager.exportProjectAsMidi();
          }
        }
      });
    }

    const importMidiInput = document.getElementById('roll-import-midi-input');
    if (importMidiInput) {
      importMidiInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && window.exportManager) {
          window.exportManager.importMidiFile(file);
        }
      });
    }

    // 11. Modal Close
    const closeBtn = document.getElementById('close-piano-roll-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
  }

  _bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const code = e.code;
      const isCtrl = e.ctrlKey || e.metaKey;

      if (code === 'Space') {
        e.preventDefault();
        if (window.trackManager) window.trackManager.togglePlay();
        return;
      }

      if (code === 'Delete' || code === 'Backspace') {
        e.preventDefault();
        this._saveHistoryState();
        this.deleteSelected();
        return;
      }

      if (isCtrl && code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        return;
      }

      if (isCtrl && code === 'KeyY') {
        e.preventDefault();
        this.redo();
        return;
      }

      if (isCtrl && code === 'KeyC') {
        e.preventDefault();
        this.copySelected();
        return;
      }

      if (isCtrl && code === 'KeyV') {
        e.preventDefault();
        this.paste();
        return;
      }

      if (isCtrl && code === 'KeyD') {
        e.preventDefault();
        this.duplicateSelected();
        return;
      }

      if (isCtrl && code === 'KeyA') {
        e.preventDefault();
        this.selectAll();
        return;
      }

      // Transposition via Arrow keys
      if (code === 'ArrowUp') {
        e.preventDefault();
        const delta = e.shiftKey ? 12 : 1;
        this.transposeSelected(delta);
        return;
      }

      if (code === 'ArrowDown') {
        e.preventDefault();
        const delta = e.shiftKey ? -12 : -1;
        this.transposeSelected(delta);
        return;
      }

      // Time Nudge via Arrow keys
      if (code === 'ArrowRight') {
        e.preventDefault();
        this.nudgeSelected(1);
        return;
      }

      if (code === 'ArrowLeft') {
        e.preventDefault();
        this.nudgeSelected(-1);
        return;
      }

      if (code === 'Escape') {
        e.preventDefault();
        if (this.selectedNoteIds.size > 0) {
          this.selectedNoteIds.clear();
          this._updateSelectionVisuals();
        } else {
          this.close();
        }
        return;
      }
    });
  }

  /**
   * Creates a new note at mouse pixel coordinates
   */
  _createNewNoteAt(clickX, clickY) {
    if (!this.currentTrack) return;
    this._saveHistoryState();

    const rowIndex = Math.floor(clickY / this.keyHeight);
    const midi = this.endNote - rowIndex;
    if (midi < this.startNote || midi > this.endNote) return;

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;
    const beatClicked = clickX / this.pixelsPerBeat;
    const snap = this.snapBeats > 0 ? this.snapBeats : 0.0625;
    const snappedBeat = Math.floor(beatClicked / snap) * snap;
    const startTimeMs = Math.round(snappedBeat * msPerBeat);
    const durationMs = Math.round(Math.max(snap, 0.25) * msPerBeat);

    const newNote = {
      id: `ev_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      midiNote: midi,
      startTimeMs,
      durationMs,
      velocity: 0.85
    };

    this.currentTrack.events.push(newNote);
    this.selectedNoteIds.clear();
    this.selectedNoteIds.add(newNote.id);

    this._auditionNote(midi);
    this.render();
  }

  deleteNote(noteId) {
    if (!this.currentTrack) return;
    this.currentTrack.events = this.currentTrack.events.filter(ev => ev.id !== noteId);
    this.selectedNoteIds.delete(noteId);
    this.render();
  }

  deleteSelected() {
    if (!this.currentTrack || this.selectedNoteIds.size === 0) return;
    this.currentTrack.events = this.currentTrack.events.filter(ev => !this.selectedNoteIds.has(ev.id));
    this.selectedNoteIds.clear();
    this.render();
  }

  selectAll() {
    if (!this.currentTrack) return;
    this.selectedNoteIds = new Set(this.currentTrack.events.map(ev => ev.id));
    this._updateSelectionVisuals();
  }

  copySelected() {
    if (!this.currentTrack || this.selectedNoteIds.size === 0) return;
    const selected = this.currentTrack.events.filter(ev => this.selectedNoteIds.has(ev.id));
    const minStart = Math.min(...selected.map(ev => ev.startTimeMs || 0));
    this.clipboard = selected.map(ev => ({
      ...ev,
      relativeStartMs: (ev.startTimeMs || 0) - minStart
    }));
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`Copied ${this.clipboard.length} notes`);
    }
  }

  paste() {
    if (!this.currentTrack || this.clipboard.length === 0) return;
    this._saveHistoryState();

    const playheadMs = (window.trackManager && window.trackManager.playheadPositionMs) || 0;
    this.selectedNoteIds.clear();

    this.clipboard.forEach(item => {
      const newNote = {
        id: `ev_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        midiNote: item.midiNote,
        startTimeMs: playheadMs + item.relativeStartMs,
        durationMs: item.durationMs,
        velocity: item.velocity
      };
      this.currentTrack.events.push(newNote);
      this.selectedNoteIds.add(newNote.id);
    });

    this.render();
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`Pasted ${this.clipboard.length} notes`);
    }
  }

  duplicateSelected() {
    if (!this.currentTrack || this.selectedNoteIds.size === 0) return;
    this._saveHistoryState();

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;
    const snapMs = (this.snapBeats > 0 ? this.snapBeats : 1) * msPerBeat;

    const selected = this.currentTrack.events.filter(ev => this.selectedNoteIds.has(ev.id));
    const maxEnd = Math.max(...selected.map(ev => (ev.startTimeMs || 0) + (ev.durationMs || 300)));
    const minStart = Math.min(...selected.map(ev => ev.startTimeMs || 0));
    const offsetMs = Math.max(snapMs, maxEnd - minStart);

    this.selectedNoteIds.clear();

    selected.forEach(ev => {
      const duplicated = {
        id: `ev_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        midiNote: ev.midiNote,
        startTimeMs: ev.startTimeMs + offsetMs,
        durationMs: ev.durationMs,
        velocity: ev.velocity
      };
      this.currentTrack.events.push(duplicated);
      this.selectedNoteIds.add(duplicated.id);
    });

    this.render();
  }

  transposeSelected(semitones) {
    if (!this.currentTrack || this.selectedNoteIds.size === 0) return;
    this._saveHistoryState();

    this.currentTrack.events.forEach(ev => {
      if (this.selectedNoteIds.has(ev.id)) {
        ev.midiNote = Math.max(this.startNote, Math.min(this.endNote, ev.midiNote + semitones));
      }
    });

    this.render();
  }

  nudgeSelected(direction) {
    if (!this.currentTrack || this.selectedNoteIds.size === 0) return;
    this._saveHistoryState();

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;
    const snap = this.snapBeats > 0 ? this.snapBeats : 0.25;
    const deltaMs = direction * snap * msPerBeat;

    this.currentTrack.events.forEach(ev => {
      if (this.selectedNoteIds.has(ev.id)) {
        ev.startTimeMs = Math.max(0, ev.startTimeMs + deltaMs);
      }
    });

    this.render();
  }

  quantizeSelected() {
    if (!this.currentTrack) return;
    this._saveHistoryState();

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;
    const snap = this.snapBeats > 0 ? this.snapBeats : 0.25;
    const snapMs = snap * msPerBeat;

    const notesToQuantize = this.selectedNoteIds.size > 0
      ? this.currentTrack.events.filter(ev => this.selectedNoteIds.has(ev.id))
      : this.currentTrack.events;

    notesToQuantize.forEach(ev => {
      ev.startTimeMs = Math.round(ev.startTimeMs / snapMs) * snapMs;
      ev.durationMs = Math.max(snapMs, Math.round((ev.durationMs || snapMs) / snapMs) * snapMs);
    });

    this.render();
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`Quantized ${notesToQuantize.length} notes to ${snap} grid`);
    }
  }

  _seekFromPixel(pixelX) {
    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;
    const beats = Math.max(0, pixelX / this.pixelsPerBeat);
    const timeMs = beats * msPerBeat;

    if (window.trackManager) {
      window.trackManager.seekTo(timeMs);
    }
    this._updatePlayheadUI(timeMs);
  }

  _auditionNote(midiNote) {
    if (!window.audioEngine) return;
    window.audioEngine.ensureContext().then(() => {
      const inst = window.instrumentManager ? (window.instrumentManager.getInstrument(this.currentTrack.instrumentId) || window.instrumentManager.currentInstrument) : null;
      if (inst && window.soundFontManager) {
        const voice = window.soundFontManager.playNote(inst, midiNote, 0.85);
        setTimeout(() => { if (voice) voice.stop(); }, 350);
      }
    });
  }

  _saveHistoryState() {
    if (!this.currentTrack) return;
    const snapshot = JSON.stringify(this.currentTrack.events);
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo upon new action
  }

  undo() {
    if (!this.currentTrack || this.undoStack.length === 0) return;
    const currentSnapshot = JSON.stringify(this.currentTrack.events);
    this.redoStack.push(currentSnapshot);

    const previousSnapshot = this.undoStack.pop();
    this.currentTrack.events = JSON.parse(previousSnapshot);
    this.selectedNoteIds.clear();
    this.render();
  }

  redo() {
    if (!this.currentTrack || this.redoStack.length === 0) return;
    const currentSnapshot = JSON.stringify(this.currentTrack.events);
    this.undoStack.push(currentSnapshot);

    const nextSnapshot = this.redoStack.pop();
    this.currentTrack.events = JSON.parse(nextSnapshot);
    this.selectedNoteIds.clear();
    this.render();
  }

  _updateSelectionVisuals() {
    const noteBlocks = this.gridEl.querySelectorAll('.roll-note-block');
    noteBlocks.forEach(el => {
      const id = el.dataset.noteId;
      el.classList.toggle('selected', this.selectedNoteIds.has(id));
    });

    if (this.velocityBarsEl) {
      const bars = this.velocityBarsEl.querySelectorAll('.roll-vel-bar');
      bars.forEach(el => {
        const id = el.dataset.noteId;
        el.classList.toggle('selected', this.selectedNoteIds.has(id));
      });
    }
  }

  _scrollKeysToNote(midiNote) {
    const keyEl = this.keyboardGutterEl.querySelector(`[data-midi="${midiNote}"]`);
    const gridScroll = document.getElementById('piano-roll-grid-scroll');
    if (keyEl && gridScroll) {
      const targetTop = keyEl.offsetTop - (gridScroll.clientHeight / 2) + 50;
      gridScroll.scrollTop = Math.max(0, targetTop);
    }
  }

  _startPlayheadAnimation() {
    const loop = () => {
      if (!this.isOpen) return;

      if (window.trackManager) {
        const timeMs = window.trackManager.playheadPositionMs;
        this._updatePlayheadUI(timeMs);
        this._updateTransportUI();
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  _updatePlayheadUI(timeMs) {
    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const msPerBeat = (60 / bpm) * 1000;
    const currentBeats = timeMs / msPerBeat;
    const playheadPx = currentBeats * this.pixelsPerBeat;

    if (this.playheadEl) {
      this.playheadEl.style.left = `${playheadPx}px`;
    }

    // Timecode Display
    const tc = document.getElementById('roll-timecode-display');
    if (tc) {
      const bar = Math.floor(currentBeats / 4) + 1;
      const beat = Math.floor(currentBeats % 4) + 1;
      const subTick = Math.floor((currentBeats % 1) * 100);
      tc.textContent = `${String(bar).padStart(2, '0')}.${beat}.${String(subTick).padStart(2, '0')}`;
    }
  }

  _updateTransportUI() {
    const playBtn = document.getElementById('roll-play-btn');
    if (playBtn && window.trackManager) {
      if (window.trackManager.isPlaying) {
        playBtn.classList.add('playing');
        playBtn.textContent = '⏸ Pause';
      } else {
        playBtn.classList.remove('playing');
        playBtn.textContent = '▶ Play';
      }
    }
  }

  _getRootSemitone(rootName) {
    const map = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    return map[rootName] !== undefined ? map[rootName] : 0;
  }

  _getInScaleSemitones() {
    if (this.scaleType === 'off' || !window.musicTheoryLab) return new Set();
    const scaleObj = window.musicTheoryLab.SCALES_DICTIONARY[this.scaleType] || window.musicTheoryLab.SCALES_DICTIONARY.major;
    const rootSemi = this._getRootSemitone(this.scaleRoot);
    return new Set(scaleObj.intervals.map(int => (rootSemi + int) % 12));
  }
}

window.pianoRoll = new PianoRoll();
