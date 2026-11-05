/**
 * Virtual Music Studio - Note Mapper
 * Maps QWERTY keyboard codes, MIDI numbers, musical note names, frequencies, and scales.
 */

class NoteMapper {
  constructor() {
    this.baseOctave = 4;
    this.velocity = 0.85; // 0.0 to 1.0
    this.sustainPedal = false;
    this.pitchBendSemitones = 0;

    this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Default QWERTY Keyboard Layout (2 chromatic octaves accessible)
    this.keyMap = {
      // Lower Octave (Base Octave)
      'KeyA': { semitone: 0,  noteName: 'C',  octaveOffset: 0, isBlack: false }, // C4
      'KeyW': { semitone: 1,  noteName: 'C#', octaveOffset: 0, isBlack: true },
      'KeyS': { semitone: 2,  noteName: 'D',  octaveOffset: 0, isBlack: false },
      'KeyE': { semitone: 3,  noteName: 'D#', octaveOffset: 0, isBlack: true },
      'KeyD': { semitone: 4,  noteName: 'E',  octaveOffset: 0, isBlack: false },
      'KeyF': { semitone: 5,  noteName: 'F',  octaveOffset: 0, isBlack: false },
      'KeyT': { semitone: 6,  noteName: 'F#', octaveOffset: 0, isBlack: true },
      'KeyG': { semitone: 7,  noteName: 'G',  octaveOffset: 0, isBlack: false },
      'KeyY': { semitone: 8,  noteName: 'G#', octaveOffset: 0, isBlack: true },
      'KeyH': { semitone: 9,  noteName: 'A',  octaveOffset: 0, isBlack: false },
      'KeyU': { semitone: 10, noteName: 'A#', octaveOffset: 0, isBlack: true },
      'KeyJ': { semitone: 11, noteName: 'B',  octaveOffset: 0, isBlack: false },

      // Upper Octave (Base Octave + 1)
      'KeyK':        { semitone: 0,  noteName: 'C',  octaveOffset: 1, isBlack: false }, // C5
      'KeyO':        { semitone: 1,  noteName: 'C#', octaveOffset: 1, isBlack: true },
      'KeyL':        { semitone: 2,  noteName: 'D',  octaveOffset: 1, isBlack: false },
      'KeyP':        { semitone: 3,  noteName: 'D#', octaveOffset: 1, isBlack: true },
      'Semicolon':   { semitone: 4,  noteName: 'E',  octaveOffset: 1, isBlack: false },
      'Quote':       { semitone: 5,  noteName: 'F',  octaveOffset: 1, isBlack: false },
      'BracketLeft': { semitone: 6,  noteName: 'F#', octaveOffset: 1, isBlack: true },
      'Enter':       { semitone: 7,  noteName: 'G',  octaveOffset: 1, isBlack: false }
    };
  }

  getMidiNoteForKey(keyCode) {
    const mapping = this.keyMap[keyCode];
    if (!mapping) return null;

    const octave = this.baseOctave + mapping.octaveOffset;
    // MIDI note formula: (octave + 1) * 12 + semitone
    const midi = (octave + 1) * 12 + mapping.semitone;

    // Clamp to 88-key acoustic piano range (A0 = 21 to C8 = 108)
    if (midi < 21 || midi > 108) {
      return null;
    }

    return {
      midiNote: midi,
      noteName: `${mapping.noteName}${octave}`,
      octave,
      semitone: mapping.semitone,
      isBlack: mapping.isBlack,
      pitchName: mapping.noteName
    };
  }

  getNoteInfoFromMidi(midi) {
    const semitone = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const pitchName = this.NOTE_NAMES[semitone];
    const isBlack = pitchName.includes('#');
    return {
      midiNote: midi,
      noteName: `${pitchName}${octave}`,
      octave,
      semitone,
      pitchName,
      isBlack,
      frequency: 440 * Math.pow(2, (midi - 69) / 12)
    };
  }

  getQwertyLabelForMidi(midi) {
    for (const [code, map] of Object.entries(this.keyMap)) {
      const oct = this.baseOctave + map.octaveOffset;
      const m = (oct + 1) * 12 + map.semitone;
      if (m === midi) {
        return this.formatKeyName(code);
      }
    }
    return '';
  }

  formatKeyName(code) {
    if (code.startsWith('Key')) return code.substring(3);
    if (code === 'Semicolon') return ';';
    if (code === 'Quote') return "'";
    if (code === 'BracketLeft') return '[';
    if (code === 'Enter') return '↵';
    return code;
  }

  setOctave(octave) {
    this.baseOctave = Math.max(1, Math.min(7, octave));
    return this.baseOctave;
  }

  shiftOctave(delta) {
    return this.setOctave(this.baseOctave + delta);
  }

  setVelocity(vel) {
    this.velocity = Math.max(0.1, Math.min(1.0, vel));
    return this.velocity;
  }

  shiftVelocity(delta) {
    return this.setVelocity(this.velocity + delta);
  }
}

window.noteMapper = new NoteMapper();
