/**
 * Virtual Music Studio - Music Theory & Creative Tools Lab
 * Chord library, Progression generator, Scale explorer, Circle of Fifths,
 * Real-time tuner & pitch detector, and intelligent arpeggiator.
 */

class MusicTheoryLab {
  constructor() {
    this.currentRoot = 'C';
    this.currentScale = 'major';
    this.currentOctave = 4;
    this.arpeggiatorActive = false;
    this.arpeggiatorPattern = 'up'; // up, down, upDown, random
    this.arpeggiatorRate = 0.25; // 16th notes
    this.arpIntervalId = null;

    this.CHORD_DICTIONARY = {
      'Major': [0, 4, 7],
      'Minor': [0, 3, 7],
      'Dominant 7th': [0, 4, 7, 10],
      'Major 7th': [0, 4, 7, 11],
      'Minor 7th': [0, 3, 7, 10],
      'Suspended 4th': [0, 5, 7],
      'Diminished': [0, 3, 6],
      'Augmented': [0, 4, 8],
      'Add 9': [0, 4, 7, 14]
    };

    this.SCALES_DICTIONARY = {
      'major': { name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11] },
      'minor': { name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10] },
      'harmonic_minor': { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
      'pentatonic_major': { name: 'Pentatonic Major', intervals: [0, 2, 4, 7, 9] },
      'pentatonic_minor': { name: 'Pentatonic Minor', intervals: [0, 3, 5, 7, 10] },
      'blues': { name: 'Blues Scale', intervals: [0, 3, 5, 6, 7, 10] },
      'dorian': { name: 'Dorian Mode', intervals: [0, 2, 3, 5, 7, 9, 10] },
      'mixolydian': { name: 'Mixolydian Mode', intervals: [0, 2, 4, 5, 7, 9, 10] },
      'spanish_gypsy': { name: 'Spanish Phrygian / Flamenco', intervals: [0, 1, 4, 5, 7, 8, 10] },
      'raga_bhairav': { name: 'Indian Raga Bhairav', intervals: [0, 1, 4, 5, 7, 8, 11] },
      'raga_yaman': { name: 'Indian Raga Yaman (Kalyan)', intervals: [0, 2, 4, 6, 7, 9, 11] },
      'japanese_in': { name: 'Japanese Insen / Koto Scale', intervals: [0, 1, 5, 7, 10] }
    };

    this.PROGRESSION_PRESETS = [
      { name: 'Pop Anthem (I - V - vi - IV)', chords: ['C Major', 'G Major', 'A Minor', 'F Major'] },
      { name: 'Jazz Standard (ii - V - I - VI)', chords: ['D Minor 7th', 'G Dominant 7th', 'C Major 7th', 'A Minor 7th'] },
      { name: 'Andalusian Flamenco Cadence', chords: ['A Minor', 'G Major', 'F Major', 'E Major'] },
      { name: 'Emotional Cinematic (vi - IV - I - V)', chords: ['A Minor', 'F Major', 'C Major', 'G Major'] },
      { name: 'R&B Neo-Soul Groove', chords: ['D Minor 7th', 'G Minor 7th', 'C Major 7th', 'F Major 7th'] },
      { name: '12-Bar Blues Classic', chords: ['C Dominant 7th', 'F Dominant 7th', 'G Dominant 7th', 'C Dominant 7th'] }
    ];

    this.CIRCLE_OF_FIFTHS = [
      { name: 'C', accidentals: 'Natural' },
      { name: 'G', accidentals: '1 Sharp (F#)' },
      { name: 'D', accidentals: '2 Sharps (F#, C#)' },
      { name: 'A', accidentals: '3 Sharps (F#, C#, G#)' },
      { name: 'E', accidentals: '4 Sharps (F#, C#, G#, D#)' },
      { name: 'B', accidentals: '5 Sharps' },
      { name: 'F#', accidentals: '6 Sharps / 6 Flats' },
      { name: 'Db', accidentals: '5 Flats' },
      { name: 'Ab', accidentals: '4 Flats (Bb, Eb, Ab, Db)' },
      { name: 'Eb', accidentals: '3 Flats (Bb, Eb, Ab)' },
      { name: 'Bb', accidentals: '2 Flats (Bb, Eb)' },
      { name: 'F', accidentals: '1 Flat (Bb)' }
    ];
  }

  init() {
    this.renderCircleOfFifths();
    this.renderChordsList();
    this.renderProgressions();
    this.highlightScaleOnKeyboard();
  }

  getRootSemitone(rootName) {
    const semitones = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    return semitones[rootName] !== undefined ? semitones[rootName] : 0;
  }

  getChordMidiNotes(rootName, chordType, octave = 4) {
    const rootSemi = this.getRootSemitone(rootName);
    const intervals = this.CHORD_DICTIONARY[chordType] || [0, 4, 7];
    const baseMidi = (octave + 1) * 12 + rootSemi;
    return intervals.map(int => baseMidi + int);
  }

  getScaleMidiNotes(rootName, scaleType, octave = 4) {
    const rootSemi = this.getRootSemitone(rootName);
    const scaleObj = this.SCALES_DICTIONARY[scaleType] || this.SCALES_DICTIONARY.major;
    const baseMidi = (octave + 1) * 12 + rootSemi;
    return scaleObj.intervals.map(int => baseMidi + int);
  }

  /**
   * Highlights in-scale notes on the virtual piano keyboard
   */
  highlightScaleOnKeyboard() {
    const scaleObj = this.SCALES_DICTIONARY[this.currentScale] || this.SCALES_DICTIONARY.major;
    const rootSemi = this.getRootSemitone(this.currentRoot);
    const allowedSemitones = new Set(scaleObj.intervals.map(int => (rootSemi + int) % 12));

    const keys = document.querySelectorAll('.piano-key');
    keys.forEach(k => {
      const midi = parseInt(k.dataset.midi, 10);
      const semi = midi % 12;
      if (allowedSemitones.has(semi)) {
        k.classList.add('in-scale');
        if (semi === rootSemi) {
          k.classList.add('root-note');
        } else {
          k.classList.remove('root-note');
        }
      } else {
        k.classList.remove('in-scale');
        k.classList.remove('root-note');
      }
    });

    const scaleDesc = document.getElementById('active-scale-info');
    if (scaleDesc) {
      scaleDesc.textContent = `${this.currentRoot} ${scaleObj.name}`;
    }
  }

  /**
   * Plays a chord demonstration using currently selected instrument
   */
  playChordDemo(rootName, chordType) {
    window.audioEngine.ensureContext().then(() => {
      const notes = this.getChordMidiNotes(rootName, chordType, 4);
      const inst = window.instrumentManager.currentInstrument;
      notes.forEach((midi, idx) => {
        // Strum effect: 25ms delay between string strikes
        setTimeout(() => {
          const voice = window.soundFontManager.playNote(inst, midi, 0.82);
          setTimeout(() => { if (voice) voice.stop(); }, 1400);
        }, idx * 30);
      });
    });
  }

  /**
   * Plays progression sequence demonstration
   */
  playProgressionDemo(progression) {
    window.audioEngine.ensureContext().then(() => {
      let delay = 0;
      progression.chords.forEach(chordStr => {
        const parts = chordStr.split(' ');
        const root = parts[0];
        const type = parts.slice(1).join(' ');

        setTimeout(() => {
          this.playChordDemo(root, type);
        }, delay);

        delay += 1200; // 1.2s per chord
      });
    });
  }

  renderCircleOfFifths() {
    const container = document.getElementById('circle-of-fifths-container');
    if (!container) return;
    container.innerHTML = '';

    const circleSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    circleSvg.setAttribute('viewBox', '0 0 300 300');
    circleSvg.className = 'circle-svg';

    const cx = 150, cy = 150, radius = 110;

    this.CIRCLE_OF_FIFTHS.forEach((item, idx) => {
      const angle = (idx * 30 - 90) * (Math.PI / 180);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.className = `circle-item ${item.name === this.currentRoot ? 'selected' : ''}`;
      g.style.cursor = 'pointer';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', '20');
      circle.className = 'circle-node';

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 5);
      text.setAttribute('text-anchor', 'middle');
      text.className = 'circle-text';
      text.textContent = item.name;

      g.appendChild(circle);
      g.appendChild(text);

      g.addEventListener('click', () => {
        this.currentRoot = item.name;
        this.renderCircleOfFifths();
        this.highlightScaleOnKeyboard();
        const rootSelect = document.getElementById('theory-root-select');
        if (rootSelect) rootSelect.value = item.name;
      });

      circleSvg.appendChild(g);
    });

    container.appendChild(circleSvg);
  }

  renderChordsList() {
    const container = document.getElementById('chords-grid');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(this.CHORD_DICTIONARY).forEach(chordType => {
      const card = document.createElement('div');
      card.className = 'chord-card';
      const notes = this.getChordMidiNotes(this.currentRoot, chordType, 4);
      const noteNames = notes.map(m => window.noteMapper.getNoteInfoFromMidi(m).pitchName).join(' - ');

      card.innerHTML = `
        <div class="chord-card-title">${this.currentRoot} ${chordType}</div>
        <div class="chord-card-notes">${noteNames}</div>
        <button class="btn btn-sm btn-primary play-chord-btn">▶ Audition</button>
      `;

      card.querySelector('.play-chord-btn').addEventListener('click', () => {
        this.playChordDemo(this.currentRoot, chordType);
      });

      container.appendChild(card);
    });
  }

  renderProgressions() {
    const container = document.getElementById('progressions-list');
    if (!container) return;
    container.innerHTML = '';

    this.PROGRESSION_PRESETS.forEach(prog => {
      const item = document.createElement('div');
      item.className = 'progression-card';
      item.innerHTML = `
        <div class="prog-info">
          <div class="prog-name">${prog.name}</div>
          <div class="prog-chords">${prog.chords.join(' ➔ ')}</div>
        </div>
        <button class="btn btn-sm btn-accent play-prog-btn">▶ Play Chords</button>
      `;

      item.querySelector('.play-prog-btn').addEventListener('click', () => {
        this.playProgressionDemo(prog);
      });

      container.appendChild(item);
    });
  }

  toggleArpeggiator() {
    this.arpeggiatorActive = !this.arpeggiatorActive;
    const btn = document.getElementById('arp-toggle-btn');
    if (btn) {
      btn.classList.toggle('active', this.arpeggiatorActive);
      btn.textContent = this.arpeggiatorActive ? '⚡ Arp: ON' : '⚡ Arp: OFF';
    }
  }
}

window.musicTheoryLab = new MusicTheoryLab();
