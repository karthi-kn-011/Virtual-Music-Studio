/**
 * Virtual Music Studio - Diatonic Chord Progression Generator (Phase 13)
 * Full diatonic scale harmonization, Roman numeral analysis, chord extensions & inversions,
 * progression presets, real-time audition, and direct MIDI track injection into Arranger.
 */

class ChordGenerator {
  constructor() {
    this.rootKey = 'C';
    this.scaleType = 'major';
    this.octave = 4;
    this.voicing = 'close'; // 'close', 'open', 'drop2'
    this.durationBeats = 4; // 1 bar (4 beats) by default
    this.containerEl = null;

    // Active progression list: [{ root, type, inversion, durationBeats, roman }]
    this.progression = [
      { root: 'C', type: 'Major', inversion: 0, durationBeats: 4, roman: 'I' },
      { root: 'G', type: 'Major', inversion: 0, durationBeats: 4, roman: 'V' },
      { root: 'A', type: 'Minor', inversion: 0, durationBeats: 4, roman: 'vi' },
      { root: 'F', type: 'Major', inversion: 0, durationBeats: 4, roman: 'IV' }
    ];

    this.isPlaying = false;
    this.playTimerId = null;

    this.KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    this.SCALES = {
      major: {
        name: 'Major (Ionian)',
        intervals: [0, 2, 4, 5, 7, 9, 11],
        triads: ['Major', 'Minor', 'Minor', 'Major', 'Major', 'Minor', 'Diminished'],
        sevenths: ['Major 7th', 'Minor 7th', 'Minor 7th', 'Major 7th', 'Dominant 7th', 'Minor 7th', 'Half-Diminished 7th'],
        romans: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
      },
      minor: {
        name: 'Natural Minor (Aeolian)',
        intervals: [0, 2, 3, 5, 7, 8, 10],
        triads: ['Minor', 'Diminished', 'Major', 'Minor', 'Minor', 'Major', 'Major'],
        sevenths: ['Minor 7th', 'Half-Diminished 7th', 'Major 7th', 'Minor 7th', 'Minor 7th', 'Major 7th', 'Dominant 7th'],
        romans: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
      },
      harmonic_minor: {
        name: 'Harmonic Minor',
        intervals: [0, 2, 3, 5, 7, 8, 11],
        triads: ['Minor', 'Diminished', 'Augmented', 'Minor', 'Major', 'Major', 'Diminished'],
        sevenths: ['Minor-Major 7th', 'Half-Diminished 7th', 'Augmented Major 7th', 'Minor 7th', 'Dominant 7th', 'Major 7th', 'Diminished 7th'],
        romans: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']
      },
      dorian: {
        name: 'Dorian Mode',
        intervals: [0, 2, 3, 5, 7, 9, 10],
        triads: ['Minor', 'Minor', 'Major', 'Major', 'Minor', 'Diminished', 'Major'],
        sevenths: ['Minor 7th', 'Minor 7th', 'Major 7th', 'Dominant 7th', 'Minor 7th', 'Half-Diminished 7th', 'Major 7th'],
        romans: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII']
      },
      mixolydian: {
        name: 'Mixolydian Mode',
        intervals: [0, 2, 4, 5, 7, 9, 10],
        triads: ['Major', 'Minor', 'Diminished', 'Major', 'Minor', 'Minor', 'Major'],
        sevenths: ['Dominant 7th', 'Minor 7th', 'Half-Diminished 7th', 'Major 7th', 'Minor 7th', 'Minor 7th', 'Major 7th'],
        romans: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII']
      }
    };

    this.CHORD_INTERVALS = {
      'Major': [0, 4, 7],
      'Minor': [0, 3, 7],
      'Diminished': [0, 3, 6],
      'Augmented': [0, 4, 8],
      'Sus2': [0, 2, 7],
      'Sus4': [0, 5, 7],
      'Major 7th': [0, 4, 7, 11],
      'Minor 7th': [0, 3, 7, 10],
      'Dominant 7th': [0, 4, 7, 10],
      'Half-Diminished 7th': [0, 3, 6, 10],
      'Diminished 7th': [0, 3, 6, 9],
      'Minor-Major 7th': [0, 3, 7, 11],
      'Augmented Major 7th': [0, 4, 8, 11],
      'Major 9th': [0, 4, 7, 11, 14],
      'Minor 9th': [0, 3, 7, 10, 14],
      'Dominant 9th': [0, 4, 7, 10, 14]
    };

    this.PROGRESSION_PRESETS = [
      {
        name: 'Pop Anthem (I - V - vi - IV)',
        scale: 'major',
        degrees: [
          { degree: 0, seventh: false },
          { degree: 4, seventh: false },
          { degree: 5, seventh: false },
          { degree: 3, seventh: false }
        ]
      },
      {
        name: 'Classic 50s Doo-Wop (I - vi - IV - V)',
        scale: 'major',
        degrees: [
          { degree: 0, seventh: false },
          { degree: 5, seventh: false },
          { degree: 3, seventh: false },
          { degree: 4, seventh: false }
        ]
      },
      {
        name: 'Jazz ii - V - I - VI',
        scale: 'major',
        degrees: [
          { degree: 1, seventh: true },
          { degree: 4, seventh: true },
          { degree: 0, seventh: true },
          { degree: 5, seventh: true }
        ]
      },
      {
        name: 'Neo-Soul Groove (ii9 - V9 - Imaj9)',
        scale: 'major',
        degrees: [
          { degree: 1, type: 'Minor 9th' },
          { degree: 4, type: 'Dominant 9th' },
          { degree: 0, type: 'Major 9th' },
          { degree: 5, type: 'Minor 7th' }
        ]
      },
      {
        name: 'EDM Anthem (vi - IV - I - V)',
        scale: 'major',
        degrees: [
          { degree: 5, seventh: false },
          { degree: 3, seventh: false },
          { degree: 0, seventh: false },
          { degree: 4, seventh: false }
        ]
      },
      {
        name: 'Sad & Emotional Minor (i - VI - III - VII)',
        scale: 'minor',
        degrees: [
          { degree: 0, seventh: false },
          { degree: 5, seventh: false },
          { degree: 2, seventh: false },
          { degree: 6, seventh: false }
        ]
      },
      {
        name: 'Andalusian Flamenco (i - VII - VI - V)',
        scale: 'harmonic_minor',
        degrees: [
          { degree: 0, seventh: false },
          { degree: 5, seventh: false }, // relative
          { degree: 4, seventh: false },
          { degree: 4, type: 'Major' }
        ]
      },
      {
        name: 'Synthwave 80s (i - VII - VI - VII)',
        scale: 'minor',
        degrees: [
          { degree: 0, seventh: false },
          { degree: 6, seventh: false },
          { degree: 5, seventh: false },
          { degree: 6, seventh: false }
        ]
      }
    ];
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  getRootSemitone(noteName) {
    const semitones = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    return semitones[noteName] !== undefined ? semitones[noteName] : 0;
  }

  getNoteNameFromSemitone(semitone) {
    const norm = ((semitone % 12) + 12) % 12;
    return this.KEYS[norm];
  }

  getScaleDegrees() {
    const scale = this.SCALES[this.scaleType] || this.SCALES.major;
    const rootSemi = this.getRootSemitone(this.rootKey);

    return scale.intervals.map((interval, idx) => {
      const noteSemi = (rootSemi + interval) % 12;
      const noteName = this.KEYS[noteSemi];
      const triadType = scale.triads[idx];
      const seventhType = scale.sevenths[idx];
      const roman = scale.romans[idx];

      return {
        degree: idx + 1,
        root: noteName,
        roman: roman,
        triadType: triadType,
        seventhType: seventhType
      };
    });
  }

  getMidiNotesForChord(chord) {
    const rootSemi = this.getRootSemitone(chord.root);
    const intervals = this.CHORD_INTERVALS[chord.type] || [0, 4, 7];
    let midiPitches = intervals.map(interval => (this.octave + 1) * 12 + rootSemi + interval);

    // Apply inversion
    const inv = chord.inversion || 0;
    for (let i = 0; i < inv; i++) {
      if (midiPitches.length > 0) {
        const lowest = midiPitches.shift();
        midiPitches.push(lowest + 12);
      }
    }

    // Apply voicing
    if (this.voicing === 'open' && midiPitches.length >= 3) {
      // Drop lowest root an extra octave and raise the 3rd or 5th
      midiPitches[0] -= 12;
      if (midiPitches.length >= 4) {
        midiPitches[2] += 12;
      }
    } else if (this.voicing === 'drop2' && midiPitches.length >= 4) {
      // Drop second note from top an octave
      const dropIndex = midiPitches.length - 2;
      midiPitches[dropIndex] -= 12;
      midiPitches.sort((a, b) => a - b);
    }

    return midiPitches;
  }

  loadPreset(presetIndex) {
    const preset = this.PROGRESSION_PRESETS[presetIndex];
    if (!preset) return;

    if (preset.scale) this.scaleType = preset.scale;
    const degrees = this.getScaleDegrees();

    this.progression = preset.degrees.map(d => {
      const degInfo = degrees[d.degree % degrees.length];
      const chordType = d.type || (d.seventh ? degInfo.seventhType : degInfo.triadType);
      return {
        root: degInfo.root,
        type: chordType,
        inversion: 0,
        durationBeats: 4,
        roman: degInfo.roman + (d.seventh ? '7' : '')
      };
    });

    this.render();
  }

  addChordToProgression(root, type, roman) {
    this.progression.push({
      root: root,
      type: type,
      inversion: 0,
      durationBeats: 4,
      roman: roman
    });
    this.render();
  }

  removeChord(index) {
    if (this.progression.length > 1) {
      this.progression.splice(index, 1);
      this.render();
    }
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const rootEl = document.createElement('div');
    rootEl.className = 'chord-generator-wrap';

    // Top Controls Bar (Key, Scale, Voicing, Octave, Preset selector)
    const topBar = document.createElement('div');
    topBar.className = 'chord-gen-topbar';
    topBar.innerHTML = `
      <div class="chord-gen-group">
        <label>KEY ROOT:</label>
        <select class="chord-root-select">
          ${this.KEYS.map(k => `<option value="${k}" ${k === this.rootKey ? 'selected' : ''}>${k}</option>`).join('')}
        </select>
      </div>

      <div class="chord-gen-group">
        <label>SCALE MODE:</label>
        <select class="chord-scale-select">
          ${Object.entries(this.SCALES).map(([k, v]) => `
            <option value="${k}" ${k === this.scaleType ? 'selected' : ''}>${v.name}</option>
          `).join('')}
        </select>
      </div>

      <div class="chord-gen-group">
        <label>VOICING:</label>
        <select class="chord-voicing-select">
          <option value="close" ${this.voicing === 'close' ? 'selected' : ''}>Close Voicing</option>
          <option value="open" ${this.voicing === 'open' ? 'selected' : ''}>Open Spread</option>
          <option value="drop2" ${this.voicing === 'drop2' ? 'selected' : ''}>Drop-2</option>
        </select>
      </div>

      <div class="chord-gen-group">
        <label>PROGRESSION PRESET:</label>
        <select class="chord-preset-select">
          <option value="">-- Load Progression Preset --</option>
          ${this.PROGRESSION_PRESETS.map((p, idx) => `
            <option value="${idx}">${p.name}</option>
          `).join('')}
        </select>
      </div>
    `;

    topBar.querySelector('.chord-root-select').addEventListener('change', (e) => {
      this.rootKey = e.target.value;
      this.render();
    });
    topBar.querySelector('.chord-scale-select').addEventListener('change', (e) => {
      this.scaleType = e.target.value;
      this.render();
    });
    topBar.querySelector('.chord-voicing-select').addEventListener('change', (e) => {
      this.voicing = e.target.value;
    });
    topBar.querySelector('.chord-preset-select').addEventListener('change', (e) => {
      if (e.target.value !== '') this.loadPreset(parseInt(e.target.value, 10));
    });

    rootEl.appendChild(topBar);

    // Diatonic Palette Section (Click to audition & add to active progression)
    const paletteSec = document.createElement('div');
    paletteSec.className = 'chord-palette-sec';
    paletteSec.innerHTML = `<h4 class="chord-sec-title">Diatonic Scale Chords in ${this.rootKey} ${this.SCALES[this.scaleType].name} (Click + to Add)</h4>`;

    const paletteGrid = document.createElement('div');
    paletteGrid.className = 'chord-palette-grid';

    const degrees = this.getScaleDegrees();
    degrees.forEach(deg => {
      const card = document.createElement('div');
      card.className = 'chord-degree-card';
      card.innerHTML = `
        <div class="degree-badge">${deg.roman}</div>
        <div class="chord-card-name">${deg.root} ${deg.triadType}</div>
        <div class="chord-card-buttons">
          <button class="chord-btn-play" title="Audition Triad">▶ Play</button>
          <button class="chord-btn-add" title="Add to Progression">+ Add</button>
        </div>
        <div class="chord-7th-row">
          <span class="seventh-label">${deg.seventhType}</span>
          <button class="chord-btn-add7" title="Add 7th chord">+ 7th</button>
        </div>
      `;

      card.querySelector('.chord-btn-play').addEventListener('click', () => {
        this.auditionChord({ root: deg.root, type: deg.triadType, inversion: 0 });
      });
      card.querySelector('.chord-btn-add').addEventListener('click', () => {
        this.addChordToProgression(deg.root, deg.triadType, deg.roman);
      });
      card.querySelector('.chord-btn-add7').addEventListener('click', () => {
        this.addChordToProgression(deg.root, deg.seventhType, deg.roman + '7');
      });

      paletteGrid.appendChild(card);
    });

    paletteSec.appendChild(paletteGrid);
    rootEl.appendChild(paletteSec);

    // Active Progression Timeline Section
    const progSec = document.createElement('div');
    progSec.className = 'chord-progression-sec';
    progSec.innerHTML = `
      <div class="progression-header">
        <h4 class="chord-sec-title">Active Progression (${this.progression.length} Chords)</h4>
        <div class="progression-actions">
          <button class="chord-play-prog-btn ${this.isPlaying ? 'playing' : ''}">
            ${this.isPlaying ? '⏹ Stop Progression' : '▶ Audition Progression'}
          </button>
          <button class="chord-inject-midi-btn" title="Convert progression to editable MIDI notes in Arranger">
            ⤓ Insert to MIDI Track
          </button>
        </div>
      </div>
    `;

    const progTimeline = document.createElement('div');
    progTimeline.className = 'chord-timeline-grid';

    this.progression.forEach((ch, idx) => {
      const block = document.createElement('div');
      block.className = 'chord-block-item';
      block.innerHTML = `
        <div class="chord-block-header">
          <span class="chord-block-roman">${ch.roman || ''}</span>
          <button class="chord-block-del" data-idx="${idx}" title="Remove Chord">×</button>
        </div>
        <div class="chord-block-title">${ch.root} ${ch.type}</div>
        <div class="chord-block-controls">
          <label>Inv:
            <select class="chord-inv-select" data-idx="${idx}">
              <option value="0" ${ch.inversion === 0 ? 'selected' : ''}>Root</option>
              <option value="1" ${ch.inversion === 1 ? 'selected' : ''}>1st</option>
              <option value="2" ${ch.inversion === 2 ? 'selected' : ''}>2nd</option>
              <option value="3" ${ch.inversion === 3 ? 'selected' : ''}>3rd</option>
            </select>
          </label>
          <label>Beats:
            <select class="chord-dur-select" data-idx="${idx}">
              <option value="2" ${ch.durationBeats === 2 ? 'selected' : ''}>2 (1/2 bar)</option>
              <option value="4" ${ch.durationBeats === 4 ? 'selected' : ''}>4 (1 bar)</option>
              <option value="8" ${ch.durationBeats === 8 ? 'selected' : ''}>8 (2 bars)</option>
            </select>
          </label>
        </div>
        <button class="chord-preview-single-btn" data-idx="${idx}">▶ Preview</button>
      `;

      block.querySelector('.chord-block-del').addEventListener('click', () => this.removeChord(idx));
      block.querySelector('.chord-inv-select').addEventListener('change', (e) => {
        ch.inversion = parseInt(e.target.value, 10);
      });
      block.querySelector('.chord-dur-select').addEventListener('change', (e) => {
        ch.durationBeats = parseInt(e.target.value, 10);
      });
      block.querySelector('.chord-preview-single-btn').addEventListener('click', () => {
        this.auditionChord(ch);
      });

      progTimeline.appendChild(block);
    });

    progSec.appendChild(progTimeline);
    rootEl.appendChild(progSec);

    // Bind progression actions
    const playProgBtn = progSec.querySelector('.chord-play-prog-btn');
    playProgBtn.addEventListener('click', () => this.togglePlayProgression());

    const injectBtn = progSec.querySelector('.chord-inject-midi-btn');
    injectBtn.addEventListener('click', () => this.injectProgressionToTrack());

    this.containerEl.appendChild(rootEl);
  }

  async auditionChord(chord, durationSec = 1.2) {
    await window.audioEngine.ensureContext();
    const pitches = this.getMidiNotesForChord(chord);

    pitches.forEach(pitch => {
      window.audioEngine.triggerNoteOn(pitch, 0.85);
      setTimeout(() => {
        window.audioEngine.triggerNoteOff(pitch);
      }, durationSec * 1000);
    });
  }

  async togglePlayProgression() {
    if (this.isPlaying) {
      this.stopProgression();
    } else {
      await this.playProgression();
    }
  }

  async playProgression() {
    await window.audioEngine.ensureContext();
    this.isPlaying = true;
    this.render();

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const beatDurationMs = (60 / bpm) * 1000;

    let chordIdx = 0;

    const playNext = () => {
      if (!this.isPlaying || chordIdx >= this.progression.length) {
        this.stopProgression();
        return;
      }

      const chord = this.progression[chordIdx];
      const chordDurationMs = chord.durationBeats * beatDurationMs;

      this.auditionChord(chord, (chordDurationMs * 0.95) / 1000);

      chordIdx++;
      if (chordIdx < this.progression.length) {
        this.playTimerId = setTimeout(playNext, chordDurationMs);
      } else {
        this.playTimerId = setTimeout(() => this.stopProgression(), chordDurationMs);
      }
    };

    playNext();
  }

  stopProgression() {
    this.isPlaying = false;
    if (this.playTimerId) {
      clearTimeout(this.playTimerId);
      this.playTimerId = null;
    }
    this.render();
  }

  /**
   * Convert progression into MIDI notes and append to track
   */
  injectProgressionToTrack() {
    if (!window.trackManager) {
      alert('Track Manager is not available.');
      return;
    }

    const bpm = window.trackManager.bpm || 120;
    const beatSec = 60 / bpm;
    let currentTimeSec = 0;
    const notes = [];

    this.progression.forEach(chord => {
      const pitches = this.getMidiNotesForChord(chord);
      const chordDurationSec = chord.durationBeats * beatSec;

      pitches.forEach(pitch => {
        notes.push({
          id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          midiNote: pitch,
          startTimeMs: Math.round(currentTimeSec * 1000),
          durationMs: Math.round(chordDurationSec * 0.96 * 1000),
          velocity: 0.82
        });
      });

      currentTimeSec += chordDurationSec;
    });

    const trackName = `Chords (${this.rootKey} ${this.SCALES[this.scaleType].name})`;
    const track = window.trackManager.createTrack('classical_piano', trackName);
    if (track) {
      track.events = notes;
      track.notes = notes;
      window.trackManager.renderArrangerUI();
      alert(`Injected ${this.progression.length} chords (${notes.length} MIDI notes) into track "${trackName}"!`);
    }
  }

  toJSON() {
    return {
      rootKey: this.rootKey,
      scaleType: this.scaleType,
      octave: this.octave,
      voicing: this.voicing,
      progression: this.progression
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.rootKey) this.rootKey = data.rootKey;
    if (data.scaleType) this.scaleType = data.scaleType;
    if (data.octave) this.octave = data.octave;
    if (data.voicing) this.voicing = data.voicing;
    if (data.progression) this.progression = data.progression;
    this.render();
  }
}

window.chordGenerator = new ChordGenerator();
