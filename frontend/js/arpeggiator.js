/**
 * Virtual Music Studio - Professional Arpeggiator & MIDI Humanization Subsystem (Phase 13)
 * Features:
 * - Multi-mode Arpeggiator: Up, Down, Up/Down, Down/Up, Random, As Played, Chord Strum
 * - Rate sync: 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32
 * - Octave range: 1 - 4 octaves
 * - Gate (10% - 150%) and Swing (0% - 60%)
 * - Latch / Hold mode
 * - Real-time QWERTY keyboard arpeggiation with live recording integration
 * - Non-destructive MIDI Humanization Engine (timing, velocity, duration randomization)
 */

class ArpeggiatorEngine {
  constructor() {
    this.enabled = false;
    this.pattern = 'up'; // 'up', 'down', 'up_down', 'down_up', 'random', 'as_played', 'strum'
    this.rate = '1/16'; // '1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32'
    this.octaveRange = 1; // 1, 2, 3, 4
    this.gate = 0.8; // 0.1 to 1.5
    this.swing = 0.0; // 0 to 0.6
    this.latch = false;

    // Active held notes from keyboard or MIDI: Set of MIDI note numbers
    this.heldNotes = [];
    this.latchedNotes = [];

    // Arp Playback state
    this.timerId = null;
    this.currentIndex = 0;
    this.direction = 1; // 1 for ascending, -1 for descending

    this.containerEl = null;
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  setEnabled(val) {
    this.enabled = !!val;
    if (!this.enabled) {
      this.stop();
      this.latchedNotes = [];
    } else if (this.heldNotes.length > 0 || this.latchedNotes.length > 0) {
      this.start();
    }
    this.render();
  }

  setPattern(pattern) {
    this.pattern = pattern;
    this.currentIndex = 0;
  }

  setRate(rate) {
    this.rate = rate;
  }

  setOctaves(octaves) {
    this.octaveRange = Math.max(1, Math.min(4, parseInt(octaves, 10) || 1));
  }

  setGate(gate) {
    this.gate = Math.max(0.1, Math.min(1.5, parseFloat(gate) || 0.8));
  }

  setSwing(swing) {
    this.swing = Math.max(0, Math.min(0.6, parseFloat(swing) || 0));
  }

  setLatch(latch) {
    this.latch = !!latch;
    if (!this.latch && this.heldNotes.length === 0) {
      this.latchedNotes = [];
      this.stop();
    }
  }

  /**
   * Handle note on from QWERTY or mouse
   */
  handleNoteOn(midiPitch, velocity = 0.8) {
    if (!this.enabled) return false; // Not handled by arpeggiator

    if (!this.heldNotes.includes(midiPitch)) {
      this.heldNotes.push(midiPitch);
    }

    if (this.latch) {
      this.latchedNotes = [...this.heldNotes];
    }

    if (!this.timerId) {
      this.start();
    }

    return true; // Handled
  }

  /**
   * Handle note off from QWERTY or mouse
   */
  handleNoteOff(midiPitch) {
    if (!this.enabled) return false;

    this.heldNotes = this.heldNotes.filter(n => n !== midiPitch);

    if (this.heldNotes.length === 0 && !this.latch) {
      this.stop();
    }

    return true;
  }

  clearLatchedNotes() {
    this.latchedNotes = [];
    if (this.heldNotes.length === 0) {
      this.stop();
    }
  }

  getSequence() {
    const sourceNotes = this.latch && this.heldNotes.length === 0 ? this.latchedNotes : this.heldNotes;
    if (!sourceNotes || sourceNotes.length === 0) return [];

    let expanded = [];
    for (let oct = 0; oct < this.octaveRange; oct++) {
      sourceNotes.forEach(note => {
        expanded.push(note + oct * 12);
      });
    }

    if (this.pattern === 'as_played') {
      return expanded;
    }

    // Sort ascending for pattern calculation
    const sorted = [...expanded].sort((a, b) => a - b);

    switch (this.pattern) {
      case 'up':
        return sorted;
      case 'down':
        return [...sorted].reverse();
      case 'up_down': {
        if (sorted.length <= 1) return sorted;
        const downSlice = [...sorted].slice(1, -1).reverse();
        return sorted.concat(downSlice);
      }
      case 'down_up': {
        if (sorted.length <= 1) return sorted;
        const rev = [...sorted].reverse();
        const upSlice = [...sorted].slice(1, -1);
        return rev.concat(upSlice);
      }
      case 'random':
        return sorted;
      case 'strum':
        return sorted;
      default:
        return sorted;
    }
  }

  getStepIntervalMs() {
    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const quarterMs = (60 / bpm) * 1000;

    switch (this.rate) {
      case '1/4': return quarterMs;
      case '1/8': return quarterMs / 2;
      case '1/8T': return (quarterMs / 2) * (2 / 3);
      case '1/16': return quarterMs / 4;
      case '1/16T': return (quarterMs / 4) * (2 / 3);
      case '1/32': return quarterMs / 8;
      default: return quarterMs / 4;
    }
  }

  start() {
    if (this.timerId) clearTimeout(this.timerId);
    this.currentIndex = 0;
    this._tick();
  }

  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  _tick() {
    if (!this.enabled) return;
    const seq = this.getSequence();
    if (seq.length === 0) {
      this.stop();
      return;
    }

    const intervalMs = this.getStepIntervalMs();
    let noteToPlay;

    if (this.pattern === 'random') {
      noteToPlay = seq[Math.floor(Math.random() * seq.length)];
    } else if (this.pattern === 'strum') {
      // Play all notes slightly strummed
      seq.forEach((pitch, sIdx) => {
        setTimeout(() => {
          this._triggerNote(pitch, intervalMs * this.gate);
        }, sIdx * 25);
      });
      noteToPlay = null;
    } else {
      if (this.currentIndex >= seq.length) this.currentIndex = 0;
      noteToPlay = seq[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % seq.length;
    }

    if (noteToPlay !== null) {
      this._triggerNote(noteToPlay, intervalMs * this.gate);
    }

    // Swing offset
    const isOdd = this.currentIndex % 2 !== 0;
    const swingOffset = isOdd ? (this.swing * 0.3 * intervalMs) : 0;

    this.timerId = setTimeout(() => this._tick(), intervalMs + swingOffset);
  }

  _triggerNote(midiPitch, durationMs) {
    if (!window.audioEngine) return;
    window.audioEngine.triggerNoteOn(midiPitch, 0.85);

    // If recording is active, feed note into recorder
    if (window.recordingEngine && window.recordingEngine.isRecording) {
      window.recordingEngine.recordNoteOn(midiPitch, 0.85);
      setTimeout(() => {
        window.recordingEngine.recordNoteOff(midiPitch);
      }, durationMs);
    }

    setTimeout(() => {
      window.audioEngine.triggerNoteOff(midiPitch);
    }, Math.max(30, durationMs));
  }

  /**
   * Humanization Engine: Apply realistic timing, velocity, and duration drift
   */
  humanizeNotes(notes, options = {}) {
    if (!notes || notes.length === 0) return notes;

    const {
      timingJitterMs = 15,    // +/- 15ms timing humanization
      velocityDelta = 12,     // +/- 12 velocity units
      durationJitterMs = 20   // +/- 20ms duration humanization
    } = options;

    return notes.map(note => {
      // Timing variation
      const timeOffsetSec = ((Math.random() * 2 - 1) * timingJitterMs) / 1000;
      const newStart = Math.max(0, note.startTime + timeOffsetSec);

      // Velocity variation
      const currentVel = Math.round(note.velocity * 127);
      const velOffset = Math.round((Math.random() * 2 - 1) * velocityDelta);
      const newVel = Math.max(1, Math.min(127, currentVel + velOffset)) / 127;

      // Duration variation
      const durOffsetSec = ((Math.random() * 2 - 1) * durationJitterMs) / 1000;
      const newDuration = Math.max(0.05, note.duration + durOffsetSec);

      return {
        ...note,
        startTime: newStart,
        velocity: newVel,
        duration: newDuration
      };
    });
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const rootEl = document.createElement('div');
    rootEl.className = 'arpeggiator-container';

    rootEl.innerHTML = `
      <div class="arp-header">
        <div class="arp-title-wrap">
          <span class="arp-title">PRO ARPEGGIATOR</span>
          <button class="arp-power-btn ${this.enabled ? 'active' : ''}">
            ${this.enabled ? '⚡ ON' : '○ OFF'}
          </button>
        </div>
        <button class="arp-latch-btn ${this.latch ? 'active' : ''}">
          LATCH: ${this.latch ? 'ON' : 'OFF'}
        </button>
      </div>

      <div class="arp-grid-controls">
        <div class="arp-control-group">
          <label>PATTERN</label>
          <select class="arp-pattern-select">
            <option value="up" ${this.pattern === 'up' ? 'selected' : ''}>Up ↑</option>
            <option value="down" ${this.pattern === 'down' ? 'selected' : ''}>Down ↓</option>
            <option value="up_down" ${this.pattern === 'up_down' ? 'selected' : ''}>Up / Down ⇅</option>
            <option value="down_up" ${this.pattern === 'down_up' ? 'selected' : ''}>Down / Up ⇵</option>
            <option value="random" ${this.pattern === 'random' ? 'selected' : ''}>Random 🎲</option>
            <option value="as_played" ${this.pattern === 'as_played' ? 'selected' : ''}>As Played 🎹</option>
            <option value="strum" ${this.pattern === 'strum' ? 'selected' : ''}>Strum 🎸</option>
          </select>
        </div>

        <div class="arp-control-group">
          <label>RATE</label>
          <select class="arp-rate-select">
            <option value="1/4" ${this.rate === '1/4' ? 'selected' : ''}>1/4 Quarter</option>
            <option value="1/8" ${this.rate === '1/8' ? 'selected' : ''}>1/8 Eighth</option>
            <option value="1/8T" ${this.rate === '1/8T' ? 'selected' : ''}>1/8T Triplet</option>
            <option value="1/16" ${this.rate === '1/16' ? 'selected' : ''}>1/16 Sixteenth</option>
            <option value="1/16T" ${this.rate === '1/16T' ? 'selected' : ''}>1/16T Triplet</option>
            <option value="1/32" ${this.rate === '1/32' ? 'selected' : ''}>1/32 Thirty-Second</option>
          </select>
        </div>

        <div class="arp-control-group">
          <label>OCTAVES: <span class="oct-val">${this.octaveRange}</span></label>
          <input type="range" class="arp-oct-range" min="1" max="4" value="${this.octaveRange}" step="1">
        </div>

        <div class="arp-control-group">
          <label>GATE: <span class="gate-val">${Math.round(this.gate * 100)}%</span></label>
          <input type="range" class="arp-gate-range" min="0.1" max="1.5" value="${this.gate}" step="0.05">
        </div>

        <div class="arp-control-group">
          <label>SWING: <span class="swing-val">${Math.round(this.swing * 100)}%</span></label>
          <input type="range" class="arp-swing-range" min="0" max="0.6" value="${this.swing}" step="0.05">
        </div>
      </div>

      <div class="arp-humanize-section">
        <h5 class="humanize-title">MIDI Humanizer (Active Track / Selected Notes)</h5>
        <div class="humanize-row">
          <label>Timing Jitter: <input type="number" class="humanize-timing" value="18" min="0" max="60" style="width:50px"> ms</label>
          <label>Vel Jitter: <input type="number" class="humanize-vel" value="14" min="0" max="40" style="width:50px"></label>
          <button class="humanize-apply-btn" title="Add human feel to selected or active notes">✨ Apply Humanize</button>
        </div>
      </div>
    `;

    // Event Bindings
    const powerBtn = rootEl.querySelector('.arp-power-btn');
    powerBtn.addEventListener('click', () => this.setEnabled(!this.enabled));

    const latchBtn = rootEl.querySelector('.arp-latch-btn');
    latchBtn.addEventListener('click', () => this.setLatch(!this.latch));

    rootEl.querySelector('.arp-pattern-select').addEventListener('change', (e) => this.setPattern(e.target.value));
    rootEl.querySelector('.arp-rate-select').addEventListener('change', (e) => this.setRate(e.target.value));

    const octRange = rootEl.querySelector('.arp-oct-range');
    octRange.addEventListener('input', (e) => {
      this.setOctaves(e.target.value);
      rootEl.querySelector('.oct-val').textContent = e.target.value;
    });

    const gateRange = rootEl.querySelector('.arp-gate-range');
    gateRange.addEventListener('input', (e) => {
      this.setGate(e.target.value);
      rootEl.querySelector('.gate-val').textContent = `${Math.round(e.target.value * 100)}%`;
    });

    const swingRange = rootEl.querySelector('.arp-swing-range');
    swingRange.addEventListener('input', (e) => {
      this.setSwing(e.target.value);
      rootEl.querySelector('.swing-val').textContent = `${Math.round(e.target.value * 100)}%`;
    });

    // Humanize button
    const humanizeBtn = rootEl.querySelector('.humanize-apply-btn');
    humanizeBtn.addEventListener('click', () => {
      if (!window.trackManager) return;
      const track = window.trackManager.tracks.find(t => t.id === window.trackManager.selectedTrackId);
      if (!track || !track.notes || track.notes.length === 0) {
        alert('Please select a track containing MIDI notes to humanize.');
        return;
      }

      const timing = parseInt(rootEl.querySelector('.humanize-timing').value, 10) || 18;
      const vel = parseInt(rootEl.querySelector('.humanize-vel').value, 10) || 14;

      track.notes = this.humanizeNotes(track.notes, {
        timingJitterMs: timing,
        velocityDelta: vel,
        durationJitterMs: 15
      });

      if (window.pianoRoll && window.pianoRoll.currentTrack && window.pianoRoll.currentTrack.id === track.id) {
        window.pianoRoll.render();
      }
      window.trackManager.renderArrangerUI();
      alert(`Humanized ${track.notes.length} notes in "${track.name}"!`);
    });

    this.containerEl.appendChild(rootEl);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      pattern: this.pattern,
      rate: this.rate,
      octaveRange: this.octaveRange,
      gate: this.gate,
      swing: this.swing,
      latch: this.latch
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.enabled !== undefined) this.enabled = data.enabled;
    if (data.pattern) this.pattern = data.pattern;
    if (data.rate) this.rate = data.rate;
    if (data.octaveRange) this.octaveRange = data.octaveRange;
    if (data.gate !== undefined) this.gate = data.gate;
    if (data.swing !== undefined) this.swing = data.swing;
    if (data.latch !== undefined) this.latch = data.latch;
    this.render();
  }
}

window.arpeggiatorEngine = new ArpeggiatorEngine();
