/**
 * Virtual Music Studio - Diatonic Chord Progression Generator & Harmonic Engine
 * Studio Precision Edition - Full Scale Harmonization, Inversions, Progression Audition & MIDI Export.
 */

class ChordGenerator {
  constructor() {
    this.rootKey = 'C';
    this.scaleType = 'major';
    this.octave = 4;
    this.voicing = 'close'; // 'close', 'open', 'drop2'
    this.durationBeats = 4; // Default chord duration in beats
    this.defaultVelocity = 0.82;
    this.loopProgression = true;
    this.containerEl = null;

    // Active auditioning voice tracking to avoid stuck notes
    this.activeVoices = [];

    // Active progression sequence
    this.progression = [
      { root: 'C', type: 'Major', inversion: 0, durationBeats: 4, velocity: 0.85, roman: 'I' },
      { root: 'G', type: 'Major', inversion: 0, durationBeats: 4, velocity: 0.85, roman: 'V' },
      { root: 'A', type: 'Minor', inversion: 0, durationBeats: 4, velocity: 0.85, roman: 'vi' },
      { root: 'F', type: 'Major', inversion: 0, durationBeats: 4, velocity: 0.85, roman: 'IV' }
    ];

    this.isPlaying = false;
    this.currentPlayingIndex = -1;
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
        sevenths: ['Minor-Major 7th', 'Half-Diminished 7th', 'Augmented 7th', 'Minor 7th', 'Dominant 7th', 'Major 7th', 'Diminished 7th'],
        romans: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']
      },
      melodic_minor: {
        name: 'Melodic Minor',
        intervals: [0, 2, 3, 5, 7, 9, 11],
        triads: ['Minor', 'Minor', 'Augmented', 'Major', 'Major', 'Diminished', 'Diminished'],
        sevenths: ['Minor-Major 7th', 'Minor 7th', 'Augmented 7th', 'Dominant 7th', 'Dominant 7th', 'Half-Diminished 7th', 'Half-Diminished 7th'],
        romans: ['i', 'ii', 'III+', 'IV', 'V', 'vi°', 'vii°']
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
      },
      phrygian: {
        name: 'Phrygian Mode',
        intervals: [0, 1, 3, 5, 7, 8, 10],
        triads: ['Minor', 'Major', 'Major', 'Minor', 'Diminished', 'Major', 'Minor'],
        sevenths: ['Minor 7th', 'Major 7th', 'Dominant 7th', 'Minor 7th', 'Half-Diminished 7th', 'Major 7th', 'Minor 7th'],
        romans: ['i', 'II', 'III', 'iv', 'v°', 'VI', 'vii']
      },
      lydian: {
        name: 'Lydian Mode',
        intervals: [0, 2, 4, 6, 7, 9, 11],
        triads: ['Major', 'Major', 'Minor', 'Diminished', 'Major', 'Minor', 'Minor'],
        sevenths: ['Major 7th', 'Dominant 7th', 'Minor 7th', 'Half-Diminished 7th', 'Major 7th', 'Minor 7th', 'Minor 7th'],
        romans: ['I', 'II', 'iii', 'iv°', 'V', 'vi', 'vii']
      },
      pentatonic_major: {
        name: 'Major Pentatonic',
        intervals: [0, 2, 4, 7, 9],
        triads: ['Major', 'Sus2', 'Sus4', 'Major', 'Minor'],
        sevenths: ['Major 7th', 'Minor 7th', 'Dominant 7th', 'Major 7th', 'Minor 7th'],
        romans: ['I', 'ii', 'iii', 'V', 'vi']
      },
      pentatonic_minor: {
        name: 'Minor Pentatonic',
        intervals: [0, 3, 5, 7, 10],
        triads: ['Minor', 'Major', 'Sus4', 'Minor', 'Major'],
        sevenths: ['Minor 7th', 'Major 7th', 'Minor 7th', 'Minor 7th', 'Dominant 7th'],
        romans: ['i', 'III', 'iv', 'v', 'VII']
      },
      blues: {
        name: 'Blues Scale',
        intervals: [0, 3, 5, 6, 7, 10],
        triads: ['Minor', 'Major', 'Diminished', 'Diminished', 'Major', 'Dominant 7th'],
        sevenths: ['Dominant 7th', 'Dominant 7th', 'Half-Diminished 7th', 'Diminished 7th', 'Dominant 7th', 'Dominant 7th'],
        romans: ['i', 'III', 'iv', '#iv°', 'v', 'VII']
      }
    };

    this.CHORD_INTERVALS = {
      // Triads
      'Major': [0, 4, 7],
      'Minor': [0, 3, 7],
      'Diminished': [0, 3, 6],
      'Augmented': [0, 4, 8],
      'Sus2': [0, 2, 7],
      'Sus4': [0, 5, 7],
      // 7ths
      'Major 7th': [0, 4, 7, 11],
      'Minor 7th': [0, 3, 7, 10],
      'Dominant 7th': [0, 4, 7, 10],
      'Half-Diminished 7th': [0, 3, 6, 10],
      'Diminished 7th': [0, 3, 6, 9],
      'Minor-Major 7th': [0, 3, 7, 11],
      'Augmented 7th': [0, 4, 8, 10],
      '7sus4': [0, 5, 7, 10],
      // Extended
      'Major 9th': [0, 4, 7, 11, 14],
      'Minor 9th': [0, 3, 7, 10, 14],
      'Dominant 9th': [0, 4, 7, 10, 14],
      'Add9': [0, 4, 7, 14],
      '6th': [0, 4, 7, 9],
      'Minor 6th': [0, 3, 7, 9]
    };

    this.PROGRESSION_PRESETS = [
      {
        name: 'Pop Anthem (I - V - vi - IV)',
        scale: 'major',
        chords: [
          { degree: 0, type: 'Major', roman: 'I' },
          { degree: 4, type: 'Major', roman: 'V' },
          { degree: 5, type: 'Minor', roman: 'vi' },
          { degree: 3, type: 'Major', roman: 'IV' }
        ]
      },
      {
        name: 'Classic 50s Doo-Wop (I - vi - IV - V)',
        scale: 'major',
        chords: [
          { degree: 0, type: 'Major', roman: 'I' },
          { degree: 5, type: 'Minor', roman: 'vi' },
          { degree: 3, type: 'Major', roman: 'IV' },
          { degree: 4, type: 'Major', roman: 'V' }
        ]
      },
      {
        name: 'Neo-Soul & Jazz Turnaround (ii7 - V7 - Imaj7 - vi7)',
        scale: 'major',
        chords: [
          { degree: 1, type: 'Minor 7th', roman: 'ii7' },
          { degree: 4, type: 'Dominant 7th', roman: 'V7' },
          { degree: 0, type: 'Major 7th', roman: 'Imaj7' },
          { degree: 5, type: 'Minor 7th', roman: 'vi7' }
        ]
      },
      {
        name: 'EDM Festival Anthem (vi - IV - I - V)',
        scale: 'major',
        chords: [
          { degree: 5, type: 'Minor', roman: 'vi' },
          { degree: 3, type: 'Major', roman: 'IV' },
          { degree: 0, type: 'Major', roman: 'I' },
          { degree: 4, type: 'Major', roman: 'V' }
        ]
      },
      {
        name: 'Sad & Emotional Minor (i - VI - III - VII)',
        scale: 'minor',
        chords: [
          { degree: 0, type: 'Minor', roman: 'i' },
          { degree: 5, type: 'Major', roman: 'VI' },
          { degree: 2, type: 'Major', roman: 'III' },
          { degree: 6, type: 'Major', roman: 'VII' }
        ]
      },
      {
        name: 'Andalusian Flamenco (i - VII - VI - V)',
        scale: 'harmonic_minor',
        chords: [
          { degree: 0, type: 'Minor', roman: 'i' },
          { degree: 6, type: 'Major', roman: 'VII' },
          { degree: 5, type: 'Major', roman: 'VI' },
          { degree: 4, type: 'Major', roman: 'V' }
        ]
      },
      {
        name: 'Synthwave 80s Chill (i - VII - VI - VII)',
        scale: 'minor',
        chords: [
          { degree: 0, type: 'Minor', roman: 'i' },
          { degree: 6, type: 'Major', roman: 'VII' },
          { degree: 5, type: 'Major', roman: 'VI' },
          { degree: 6, type: 'Major', roman: 'VII' }
        ]
      },
      {
        name: 'Cinematic Epic Trailer (i - iv - VI - V)',
        scale: 'harmonic_minor',
        chords: [
          { degree: 0, type: 'Minor', roman: 'i' },
          { degree: 3, type: 'Minor', roman: 'iv' },
          { degree: 5, type: 'Major', roman: 'VI' },
          { degree: 4, type: 'Major', roman: 'V' }
        ]
      },
      {
        name: 'Lo-Fi Chillhop (ii9 - V9 - Imaj9 - VI7)',
        scale: 'major',
        chords: [
          { degree: 1, type: 'Minor 9th', roman: 'ii9' },
          { degree: 4, type: 'Dominant 9th', roman: 'V9' },
          { degree: 0, type: 'Major 9th', roman: 'Imaj9' },
          { degree: 5, type: 'Dominant 7th', roman: 'VI7' }
        ]
      }
    ];
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
    console.log('[ChordGenerator] Initialized with full diatonic harmonization and Studio Precision styling.');
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
      const triadType = scale.triads[idx % scale.triads.length] || 'Major';
      const seventhType = scale.sevenths[idx % scale.sevenths.length] || 'Major 7th';
      const roman = scale.romans[idx % scale.romans.length] || `deg${idx + 1}`;

      return {
        degree: idx + 1,
        root: noteName,
        roman: roman,
        triadType: triadType,
        seventhType: seventhType
      };
    });
  }

  /**
   * Calculates actual MIDI note numbers considering Root Pitch, Octave, Chord Intervals, Inversion & Voicing
   */
  getMidiNotesForChord(chord) {
    const rootSemi = this.getRootSemitone(chord.root);
    const intervals = this.CHORD_INTERVALS[chord.type] || [0, 4, 7];
    const baseOctave = this.octave;

    // Base pitch set: (baseOctave + 1) * 12 + rootSemi + interval
    let midiPitches = intervals.map(interval => (baseOctave + 1) * 12 + rootSemi + interval);

    // Apply inversion: shift lowest notes up by 12 semitones
    const inv = Math.max(0, parseInt(chord.inversion, 10) || 0);
    const numNotes = midiPitches.length;

    for (let i = 0; i < (inv % numNotes); i++) {
      if (midiPitches.length > 0) {
        const lowest = midiPitches.shift();
        midiPitches.push(lowest + 12);
      }
    }

    // Voicing adjustments
    if (this.voicing === 'open' && midiPitches.length >= 3) {
      midiPitches[0] -= 12; // Drop root down one octave
      if (midiPitches.length >= 4) {
        midiPitches[2] += 12; // Spread 5th/7th
      }
    } else if (this.voicing === 'drop2' && midiPitches.length >= 4) {
      const dropIndex = midiPitches.length - 2;
      midiPitches[dropIndex] -= 12;
      midiPitches.sort((a, b) => a - b);
    }

    return midiPitches;
  }

  getNoteNamesForChord(chord) {
    const pitches = this.getMidiNotesForChord(chord);
    return pitches.map(p => {
      const name = this.KEYS[p % 12];
      const oct = Math.floor(p / 12) - 1;
      return `${name}${oct}`;
    });
  }

  /**
   * Audition chord with reliable Web Audio API soundfont playback and virtual piano illumination
   */
  async auditionChord(chord, durationSec = 1.2, vel = 0.82) {
    try {
      if (window.audioEngine) {
        await window.audioEngine.ensureContext();
      }
    } catch (e) {
      console.warn('[ChordGenerator] Audio context unlock error:', e);
    }

    // Stop previously ringing audition voices
    this.stopActiveVoices();

    const pitches = this.getMidiNotesForChord(chord);
    const inst = window.instrumentManager ? window.instrumentManager.currentInstrument : null;

    pitches.forEach(pitch => {
      let voice = null;

      // 1. Primary path: KeyboardController triggers audio + lights up piano key
      if (window.keyboardController) {
        voice = window.keyboardController.triggerNoteOn(pitch, vel, 'chord_gen');
      } else if (window.soundFontManager && inst) {
        // 2. Direct SoundFont fallback
        voice = window.soundFontManager.playNote(inst, pitch, vel);
      } else if (window.audioEngine) {
        // 3. AudioEngine bridge fallback
        voice = window.audioEngine.triggerNoteOn(pitch, vel, 'chord_gen');
      }

      if (voice) {
        this.activeVoices.push({ pitch, voice });
      }

      // Schedule note-off
      setTimeout(() => {
        if (window.keyboardController) {
          window.keyboardController.triggerNoteOff(pitch, 'chord_gen');
        } else if (voice && typeof voice.stop === 'function') {
          try { voice.stop(); } catch (err) {}
        }
      }, durationSec * 1000);
    });

    // Update Theory Info Box with the auditioned chord details
    this.updateTheoryInfo(chord, pitches);
  }

  stopActiveVoices() {
    this.activeVoices.forEach(({ pitch, voice }) => {
      if (window.keyboardController) {
        window.keyboardController.triggerNoteOff(pitch, 'chord_gen');
      }
      if (voice && typeof voice.stop === 'function') {
        try { voice.stop(); } catch (e) {}
      }
    });
    this.activeVoices = [];
  }

  /**
   * Plays the progression sequentially in sync with BPM with visual card highlight
   */
  async togglePlayProgression() {
    if (this.isPlaying) {
      this.stopProgression();
    } else {
      await this.playProgression();
    }
  }

  async playProgression() {
    if (this.progression.length === 0) {
      if (window.app && window.app.showToast) window.app.showToast('Progression is empty. Add chords first!');
      return;
    }

    try {
      if (window.audioEngine) {
        await window.audioEngine.ensureContext();
      }
    } catch (e) {
      console.warn('[ChordGenerator] Context error:', e);
    }

    this.isPlaying = true;
    this.currentPlayingIndex = 0;
    this._updatePlayButtonState();

    const bpm = (window.trackManager && window.trackManager.bpm) ? window.trackManager.bpm : 120;
    const beatDurationMs = (60 / bpm) * 1000;

    const playStep = () => {
      if (!this.isPlaying) return;

      if (this.currentPlayingIndex >= this.progression.length) {
        if (this.loopProgression) {
          this.currentPlayingIndex = 0;
        } else {
          this.stopProgression();
          return;
        }
      }

      const idx = this.currentPlayingIndex;
      const chord = this.progression[idx];
      const chordDurationMs = (chord.durationBeats || 4) * beatDurationMs;

      // Highlight active playing chord card
      this._highlightPlayingBlock(idx);

      // Audition chord
      this.auditionChord(chord, (chordDurationMs * 0.95) / 1000, chord.velocity || 0.85);

      this.currentPlayingIndex++;
      this.playTimerId = setTimeout(playStep, chordDurationMs);
    };

    playStep();
  }

  stopProgression() {
    this.isPlaying = false;
    this.currentPlayingIndex = -1;
    if (this.playTimerId) {
      clearTimeout(this.playTimerId);
      this.playTimerId = null;
    }
    this.stopActiveVoices();
    this._updatePlayButtonState();
    this._highlightPlayingBlock(-1);
  }

  _updatePlayButtonState() {
    const playBtn = this.containerEl ? this.containerEl.querySelector('.chord-play-prog-btn') : null;
    if (playBtn) {
      if (this.isPlaying) {
        playBtn.classList.add('playing');
        playBtn.innerHTML = '⏹ Stop Audition';
      } else {
        playBtn.classList.remove('playing');
        playBtn.innerHTML = '▶ Audition Progression';
      }
    }
  }

  _highlightPlayingBlock(activeIndex) {
    if (!this.containerEl) return;
    const blocks = this.containerEl.querySelectorAll('.chord-block-item');
    blocks.forEach((block, idx) => {
      if (idx === activeIndex) {
        block.classList.add('playing-step');
      } else {
        block.classList.remove('playing-step');
      }
    });
  }

  loadPreset(presetIndex) {
    const preset = this.PROGRESSION_PRESETS[presetIndex];
    if (!preset) return;

    if (preset.scale) this.scaleType = preset.scale;
    const degrees = this.getScaleDegrees();

    this.progression = preset.chords.map(d => {
      const degInfo = degrees[d.degree % degrees.length];
      const rootNote = degInfo ? degInfo.root : this.rootKey;
      return {
        root: rootNote,
        type: d.type || (degInfo ? degInfo.triadType : 'Major'),
        inversion: 0,
        durationBeats: 4,
        velocity: 0.85,
        roman: d.roman || (degInfo ? degInfo.roman : 'I')
      };
    });

    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast(`Loaded Preset: ${preset.name}`);
    }
  }

  addChordToProgression(root, type, roman) {
    this.progression.push({
      root: root,
      type: type,
      inversion: 0,
      durationBeats: 4,
      velocity: 0.85,
      roman: roman
    });
    this.render();
  }

  removeChord(idx) {
    this.progression.splice(idx, 1);
    this.render();
  }

  moveChord(idx, direction) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.progression.length) return;
    const temp = this.progression[idx];
    this.progression[idx] = this.progression[newIdx];
    this.progression[newIdx] = temp;
    this.render();
  }

  duplicateChord(idx) {
    const orig = this.progression[idx];
    if (!orig) return;
    const clone = Object.assign({}, orig);
    this.progression.splice(idx + 1, 0, clone);
    this.render();
  }

  clearProgression() {
    if (this.progression.length === 0) return;
    this.progression = [];
    this.stopProgression();
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

    if (this.progression.length === 0) {
      if (window.app && window.app.showToast) window.app.showToast('Progression is empty.');
      return;
    }

    const bpm = window.trackManager.bpm || 120;
    const beatSec = 60 / bpm;
    let currentTimeSec = 0;
    const notes = [];

    this.progression.forEach(chord => {
      const pitches = this.getMidiNotesForChord(chord);
      const chordDurationSec = (chord.durationBeats || 4) * beatSec;
      const vel = chord.velocity || 0.82;

      pitches.forEach(pitch => {
        notes.push({
          id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          midiNote: pitch,
          startTimeMs: Math.round(currentTimeSec * 1000),
          durationMs: Math.round(chordDurationSec * 0.96 * 1000),
          velocity: vel
        });
      });

      currentTimeSec += chordDurationSec;
    });

    const currentInst = (window.instrumentManager && window.instrumentManager.currentInstrument) 
      ? window.instrumentManager.currentInstrument.id 
      : 'classical_piano';

    const trackName = `Chords (${this.rootKey} ${this.SCALES[this.scaleType].name})`;
    const track = window.trackManager.createTrack(currentInst, trackName);
    if (track) {
      track.events = notes;
      track.notes = notes;
      window.trackManager.renderArrangerUI();
      if (window.app && window.app.showToast) {
        window.app.showToast(`Inserted ${this.progression.length} Chords (${notes.length} MIDI notes) into Track!`);
      }
    }
  }

  updateTheoryInfo(chord, pitches) {
    if (!this.containerEl) return;
    const infoBox = this.containerEl.querySelector('.chord-theory-infobox');
    if (!infoBox) return;

    const noteNames = pitches.map(p => this.KEYS[p % 12]);
    const bassNote = noteNames[0];
    const invNames = ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion'];
    const invText = invNames[chord.inversion] || `${chord.inversion}th Inversion`;

    infoBox.innerHTML = `
      <div class="theory-stat">
        <span class="stat-lbl">Chord:</span>
        <span class="stat-val highlight">${chord.root} ${chord.type}</span>
      </div>
      <div class="theory-stat">
        <span class="stat-lbl">Inversion:</span>
        <span class="stat-val">${invText}</span>
      </div>
      <div class="theory-stat">
        <span class="stat-lbl">Bass Note:</span>
        <span class="stat-val">${bassNote}</span>
      </div>
      <div class="theory-stat">
        <span class="stat-lbl">Voiced Pitches:</span>
        <span class="stat-val mono">${noteNames.join(' — ')}</span>
      </div>
    `;
  }

  /**
   * Main Render Method with Studio Precision Dark Styling
   */
  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const rootEl = document.createElement('div');
    rootEl.className = 'chord-generator-wrap';

    // 1. Top Controls Bar
    const topBar = document.createElement('div');
    topBar.className = 'chord-top-controls-bar';
    topBar.innerHTML = `
      <div class="ctrl-group">
        <label>Root Key</label>
        <select class="studio-select chord-key-select">
          ${this.KEYS.map(k => `<option value="${k}" ${k === this.rootKey ? 'selected' : ''}>${k}</option>`).join('')}
        </select>
      </div>

      <div class="ctrl-group">
        <label>Scale / Mode</label>
        <select class="studio-select chord-scale-select">
          ${Object.keys(this.SCALES).map(s => `<option value="${s}" ${s === this.scaleType ? 'selected' : ''}>${this.SCALES[s].name}</option>`).join('')}
        </select>
      </div>

      <div class="ctrl-group">
        <label>Octave</label>
        <select class="studio-select chord-octave-select">
          <option value="3" ${this.octave === 3 ? 'selected' : ''}>C3 (Warm / Low)</option>
          <option value="4" ${this.octave === 4 ? 'selected' : ''}>C4 (Standard / Mid)</option>
          <option value="5" ${this.octave === 5 ? 'selected' : ''}>C5 (Bright / High)</option>
        </select>
      </div>

      <div class="ctrl-group">
        <label>Voicing</label>
        <select class="studio-select chord-voicing-select">
          <option value="close" ${this.voicing === 'close' ? 'selected' : ''}>Close Voicing</option>
          <option value="open" ${this.voicing === 'open' ? 'selected' : ''}>Open (Spread Root)</option>
          <option value="drop2" ${this.voicing === 'drop2' ? 'selected' : ''}>Drop-2 Jazz</option>
        </select>
      </div>

      <div class="ctrl-group preset-group">
        <label>Harmonic Preset</label>
        <select class="studio-select chord-preset-select">
          <option value="">Load Songwriting Preset...</option>
          ${this.PROGRESSION_PRESETS.map((p, idx) => `<option value="${idx}">${p.name}</option>`).join('')}
        </select>
      </div>
    `;

    // Bind Top Bar events
    topBar.querySelector('.chord-key-select').addEventListener('change', (e) => {
      this.rootKey = e.target.value;
      this.render();
    });
    topBar.querySelector('.chord-scale-select').addEventListener('change', (e) => {
      this.scaleType = e.target.value;
      this.render();
    });
    topBar.querySelector('.chord-octave-select').addEventListener('change', (e) => {
      this.octave = parseInt(e.target.value, 10);
    });
    topBar.querySelector('.chord-voicing-select').addEventListener('change', (e) => {
      this.voicing = e.target.value;
    });
    topBar.querySelector('.chord-preset-select').addEventListener('change', (e) => {
      if (e.target.value !== '') this.loadPreset(parseInt(e.target.value, 10));
    });

    rootEl.appendChild(topBar);

    // 2. Diatonic Scale Harmonization Palette Section
    const paletteSec = document.createElement('div');
    paletteSec.className = 'chord-palette-sec';
    paletteSec.innerHTML = `
      <div class="sec-header-row">
        <div>
          <h3 class="chord-sec-title">Diatonic Palette in ${this.rootKey} ${this.SCALES[this.scaleType].name}</h3>
          <span class="chord-sec-subtitle">Audition any degree or add Triads & 7ths directly into your progression</span>
        </div>
      </div>
    `;

    const paletteGrid = document.createElement('div');
    paletteGrid.className = 'chord-palette-grid';

    const degrees = this.getScaleDegrees();
    degrees.forEach(deg => {
      const card = document.createElement('div');
      card.className = 'chord-degree-card';
      card.innerHTML = `
        <div class="degree-card-top">
          <span class="degree-badge">${deg.roman}</span>
          <span class="degree-num">deg ${deg.degree}</span>
        </div>
        <div class="chord-card-name">${deg.root} ${deg.triadType}</div>
        
        <div class="chord-card-buttons">
          <button class="btn btn-sm btn-ghost chord-btn-play" title="Audition Triad">▶ Play</button>
          <button class="btn btn-sm btn-primary chord-btn-add" title="Add Triad to Progression">＋ Add</button>
        </div>

        <div class="chord-7th-row">
          <span class="seventh-label">${deg.seventhType}</span>
          <button class="btn btn-xs btn-ghost chord-btn-add7" title="Add 7th Extension to Progression">＋ 7th</button>
        </div>
      `;

      card.querySelector('.chord-btn-play').addEventListener('click', (e) => {
        e.stopPropagation();
        this.auditionChord({ root: deg.root, type: deg.triadType, inversion: 0 });
      });
      card.querySelector('.chord-btn-add').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addChordToProgression(deg.root, deg.triadType, deg.roman);
      });
      card.querySelector('.chord-btn-add7').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addChordToProgression(deg.root, deg.seventhType, deg.roman + '7');
      });

      paletteGrid.appendChild(card);
    });

    paletteSec.appendChild(paletteGrid);
    rootEl.appendChild(paletteSec);

    // 3. Active Progression Timeline Section
    const progSec = document.createElement('div');
    progSec.className = 'chord-progression-sec';
    progSec.innerHTML = `
      <div class="progression-header">
        <div class="prog-title-group">
          <h3 class="chord-sec-title">Active Progression (${this.progression.length} Chords)</h3>
          <span class="chord-sec-subtitle">Arrange, invert, customize timing & inject into your multi-track project</span>
        </div>
        <div class="progression-actions">
          <label class="prog-loop-toggle">
            <input type="checkbox" class="loop-checkbox" ${this.loopProgression ? 'checked' : ''} />
            <span>Loop Playback</span>
          </label>
          <button class="btn btn-sm btn-ghost chord-clear-prog-btn" title="Clear all chords in progression">
            🗑 Clear
          </button>
          <button class="btn btn-sm btn-primary chord-play-prog-btn ${this.isPlaying ? 'playing' : ''}">
            ${this.isPlaying ? '⏹ Stop Audition' : '▶ Audition Progression'}
          </button>
          <button class="btn btn-sm btn-accent chord-inject-midi-btn" title="Convert progression to editable MIDI notes in Arranger">
            ⤓ Insert to MIDI Track
          </button>
        </div>
      </div>
    `;

    const progTimeline = document.createElement('div');
    progTimeline.className = 'chord-timeline-grid';

    if (this.progression.length === 0) {
      progTimeline.innerHTML = `
        <div class="prog-empty-state">
          <p>No chords in progression yet. Click <strong>+ Add</strong> or <strong>+ 7th</strong> from the Diatonic Palette above or choose a Songwriting Preset.</p>
        </div>
      `;
    } else {
      this.progression.forEach((ch, idx) => {
        const block = document.createElement('div');
        block.className = 'chord-block-item';
        if (this.isPlaying && this.currentPlayingIndex - 1 === idx) {
          block.classList.add('playing-step');
        }

        const pitches = this.getMidiNotesForChord(ch);
        const pitchNames = pitches.map(p => this.KEYS[p % 12]).join('-');

        block.innerHTML = `
          <div class="chord-block-header">
            <span class="chord-block-roman">${ch.roman || `deg ${idx + 1}`}</span>
            <div class="block-reorder-btns">
              <button class="btn-step-nav btn-move-left" title="Move Left" ${idx === 0 ? 'disabled' : ''}>◀</button>
              <button class="btn-step-nav btn-move-right" title="Move Right" ${idx === this.progression.length - 1 ? 'disabled' : ''}>▶</button>
              <button class="btn-step-nav btn-dup" title="Duplicate Chord">⧉</button>
              <button class="chord-block-del" title="Remove Chord">×</button>
            </div>
          </div>

          <div class="chord-block-title">${ch.root} ${ch.type}</div>
          <div class="chord-block-pitches">${pitchNames}</div>

          <div class="chord-block-controls">
            <div class="block-ctrl-row">
              <label>Inv:</label>
              <select class="studio-select chord-inv-select">
                <option value="0" ${ch.inversion === 0 ? 'selected' : ''}>Root</option>
                <option value="1" ${ch.inversion === 1 ? 'selected' : ''}>1st</option>
                <option value="2" ${ch.inversion === 2 ? 'selected' : ''}>2nd</option>
                <option value="3" ${ch.inversion === 3 ? 'selected' : ''}>3rd</option>
              </select>
            </div>
            <div class="block-ctrl-row">
              <label>Beats:</label>
              <select class="studio-select chord-dur-select">
                <option value="1" ${ch.durationBeats === 1 ? 'selected' : ''}>1 beat</option>
                <option value="2" ${ch.durationBeats === 2 ? 'selected' : ''}>2 (1/2 bar)</option>
                <option value="4" ${ch.durationBeats === 4 ? 'selected' : ''}>4 (1 bar)</option>
                <option value="8" ${ch.durationBeats === 8 ? 'selected' : ''}>8 (2 bars)</option>
              </select>
            </div>
          </div>

          <button class="btn btn-xs btn-ghost chord-preview-single-btn">▶ Preview Chord</button>
        `;

        // Event listeners
        block.querySelector('.chord-block-del').addEventListener('click', () => this.removeChord(idx));
        block.querySelector('.btn-move-left').addEventListener('click', () => this.moveChord(idx, -1));
        block.querySelector('.btn-move-right').addEventListener('click', () => this.moveChord(idx, 1));
        block.querySelector('.btn-dup').addEventListener('click', () => this.duplicateChord(idx));

        block.querySelector('.chord-inv-select').addEventListener('change', (e) => {
          ch.inversion = parseInt(e.target.value, 10);
          this.render();
        });
        block.querySelector('.chord-dur-select').addEventListener('change', (e) => {
          ch.durationBeats = parseInt(e.target.value, 10);
        });
        block.querySelector('.chord-preview-single-btn').addEventListener('click', () => {
          this.auditionChord(ch);
        });

        progTimeline.appendChild(block);
      });
    }

    progSec.appendChild(progTimeline);
    rootEl.appendChild(progSec);

    // Bind Progression Header actions
    const loopCb = progSec.querySelector('.loop-checkbox');
    if (loopCb) {
      loopCb.addEventListener('change', (e) => {
        this.loopProgression = e.target.checked;
      });
    }

    const clearBtn = progSec.querySelector('.chord-clear-prog-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearProgression());
    }

    const playProgBtn = progSec.querySelector('.chord-play-prog-btn');
    if (playProgBtn) {
      playProgBtn.addEventListener('click', () => this.togglePlayProgression());
    }

    const injectBtn = progSec.querySelector('.chord-inject-midi-btn');
    if (injectBtn) {
      injectBtn.addEventListener('click', () => this.injectProgressionToTrack());
    }

    // 4. Music Theory Info Box Panel
    const infoPanel = document.createElement('div');
    infoPanel.className = 'chord-theory-infobox';
    infoPanel.innerHTML = `
      <div class="theory-stat">
        <span class="stat-lbl">Scale:</span>
        <span class="stat-val highlight">${this.rootKey} ${this.SCALES[this.scaleType].name}</span>
      </div>
      <div class="theory-stat">
        <span class="stat-lbl">Scale Notes:</span>
        <span class="stat-val mono">${degrees.map(d => d.root).join(' - ')}</span>
      </div>
      <div class="theory-stat">
        <span class="stat-lbl">Progressions In Store:</span>
        <span class="stat-val">${this.progression.length} Chords</span>
      </div>
      <div class="theory-stat">
        <span class="stat-lbl">Pro Tip:</span>
        <span class="stat-val">Click 'Preview Chord' on any block to audition voicings before exporting to Arranger.</span>
      </div>
    `;
    rootEl.appendChild(infoPanel);

    this.containerEl.appendChild(rootEl);
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
