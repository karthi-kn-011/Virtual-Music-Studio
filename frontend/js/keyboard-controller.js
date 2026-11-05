/**
 * Virtual Music Studio - Keyboard Controller
 * Handles physical QWERTY events, on-screen virtual keyboard rendering, mouse/touch playing,
 * polyphonic voice lifecycles, and visual glowing state.
 */

class KeyboardController {
  constructor() {
    this.activeKeyVoices = new Map(); // keyCode -> voiceHandle
    this.activeMidiVoices = new Map(); // midiNote -> voiceHandle
    this.pressedKeys = new Set();
    this.sustainPedalActive = false;
    this.sustainedVoices = [];
    this.containerEl = null;
    this.startNote = 21; // A0
    this.endNote = 108;  // C8
    this.currentInstrument = null;
    this.onNoteTriggerCallbacks = [];
    this.customKeyMap = null;
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.renderVirtualKeyboard();
    this._bindPhysicalKeyboard();
    this._bindMidiSupport();

    if (window.instrumentManager) {
      this.currentInstrument = window.instrumentManager.currentInstrument;
      window.instrumentManager.onInstrumentChange(inst => {
        this.currentInstrument = inst;
        this.stopAllNotes();
      });
    }

    console.log('[KeyboardController] Virtual 88-key and QWERTY controller initialized.');
  }

  /**
   * Renders the complete 88-key acoustic keyboard with dynamic QWERTY label overlay
   */
  renderVirtualKeyboard() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const keyboardWrapper = document.createElement('div');
    keyboardWrapper.className = 'piano-keys-wrapper';

    for (let midi = this.startNote; midi <= this.endNote; midi++) {
      const noteInfo = window.noteMapper.getNoteInfoFromMidi(midi);
      const keyEl = document.createElement('div');
      keyEl.className = `piano-key ${noteInfo.isBlack ? 'black-key' : 'white-key'}`;
      keyEl.dataset.midi = midi;
      keyEl.dataset.note = noteInfo.noteName;

      // Note label & QWERTY hint
      const qwerty = window.noteMapper.getQwertyLabelForMidi(midi);
      const labelSpan = document.createElement('span');
      labelSpan.className = 'key-label';
      labelSpan.innerHTML = `
        <span class="note-name">${noteInfo.pitchName === 'C' || !noteInfo.isBlack ? noteInfo.noteName : ''}</span>
        ${qwerty ? `<span class="qwerty-hint">${qwerty}</span>` : ''}
      `;
      keyEl.appendChild(labelSpan);

      // Mouse and touch handlers
      const triggerStart = (e) => {
        e.preventDefault();
        window.audioEngine.ensureContext().then(() => {
          this.triggerNoteOn(midi, window.noteMapper.velocity, 'mouse');
        });
      };

      const triggerEnd = (e) => {
        e.preventDefault();
        this.triggerNoteOff(midi, 'mouse');
      };

      keyEl.addEventListener('mousedown', triggerStart);
      keyEl.addEventListener('mouseup', triggerEnd);
      keyEl.addEventListener('mouseleave', triggerEnd);

      keyEl.addEventListener('touchstart', triggerStart, { passive: false });
      keyEl.addEventListener('touchend', triggerEnd, { passive: false });
      keyEl.addEventListener('touchcancel', triggerEnd, { passive: false });

      keyboardWrapper.appendChild(keyEl);
    }

    this.containerEl.appendChild(keyboardWrapper);
    this.updateKeyLabels();
    this.scrollKeyboardToOctave(window.noteMapper.baseOctave);
  }

  /**
   * Refreshes QWERTY key hints on the piano keys when base octave changes
   */
  updateKeyLabels() {
    if (!this.containerEl) return;
    const keys = this.containerEl.querySelectorAll('.piano-key');
    keys.forEach(keyEl => {
      const midi = parseInt(keyEl.dataset.midi, 10);
      const noteInfo = window.noteMapper.getNoteInfoFromMidi(midi);
      const qwerty = window.noteMapper.getQwertyLabelForMidi(midi);
      const labelSpan = keyEl.querySelector('.key-label');
      if (labelSpan) {
        labelSpan.innerHTML = `
          <span class="note-name">${noteInfo.pitchName === 'C' ? noteInfo.noteName : ''}</span>
          ${qwerty ? `<span class="qwerty-hint active-hint">${qwerty}</span>` : ''}
        `;
      }
    });

    // Update octave UI display
    const octDisplay = document.getElementById('current-octave-display');
    if (octDisplay) {
      octDisplay.textContent = `C${window.noteMapper.baseOctave} - C${window.noteMapper.baseOctave + 1}`;
    }
  }

  scrollKeyboardToOctave(octave) {
    if (!this.containerEl) return;
    const centerMidi = (octave + 1) * 12; // C of base octave
    const targetKey = this.containerEl.querySelector(`[data-midi="${centerMidi}"]`);
    if (targetKey) {
      targetKey.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  _bindPhysicalKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      // Prevent key repeat when held
      if (e.repeat) return;

      const code = e.code;

      // Special action keys
      if (code === 'KeyZ') {
        e.preventDefault();
        window.noteMapper.shiftOctave(-1);
        this.updateKeyLabels();
        this.scrollKeyboardToOctave(window.noteMapper.baseOctave);
        this._showToast(`Octave Decreased: C${window.noteMapper.baseOctave}`);
        return;
      }

      if (code === 'KeyX') {
        e.preventDefault();
        window.noteMapper.shiftOctave(1);
        this.updateKeyLabels();
        this.scrollKeyboardToOctave(window.noteMapper.baseOctave);
        this._showToast(`Octave Increased: C${window.noteMapper.baseOctave}`);
        return;
      }

      if (code === 'KeyC') {
        e.preventDefault();
        const vel = Math.round(window.noteMapper.shiftVelocity(-0.1) * 100);
        this._showToast(`Velocity: ${vel}%`);
        this._updateVelocityUI();
        return;
      }

      if (code === 'KeyV') {
        e.preventDefault();
        const vel = Math.round(window.noteMapper.shiftVelocity(0.1) * 100);
        this._showToast(`Velocity: ${vel}%`);
        this._updateVelocityUI();
        return;
      }

      if (code === 'Space') {
        e.preventDefault();
        this.setSustainPedal(true);
        return;
      }

      if (code === 'Escape') {
        e.preventDefault();
        this.stopAllNotes();
        this._showToast('All notes stopped (Panic)');
        return;
      }

      // Check for note mapping
      const noteData = window.noteMapper.getMidiNoteForKey(code);
      if (noteData) {
        e.preventDefault();
        this.pressedKeys.add(code);

        // Route into Pro Arpeggiator if active
        if (window.arpeggiatorEngine && window.arpeggiatorEngine.enabled) {
          window.arpeggiatorEngine.handleNoteOn(noteData.midiNote, window.noteMapper.velocity);
          this.highlightKeyOn(noteData.midiNote);
          return;
        }

        window.audioEngine.ensureContext().then(() => {
          const voice = this.triggerNoteOn(noteData.midiNote, window.noteMapper.velocity, code);
          if (voice) {
            this.activeKeyVoices.set(code, { voice, midiNote: noteData.midiNote });
          }
        });
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      const code = e.code;

      if (code === 'Space') {
        e.preventDefault();
        this.setSustainPedal(false);
        return;
      }

      if (this.pressedKeys.has(code)) {
        this.pressedKeys.delete(code);

        // Route into Pro Arpeggiator if active
        if (window.arpeggiatorEngine && window.arpeggiatorEngine.enabled) {
          const noteData = window.noteMapper.getMidiNoteForKey(code);
          if (noteData) {
            window.arpeggiatorEngine.handleNoteOff(noteData.midiNote);
            this.highlightKeyOff(noteData.midiNote);
          }
          return;
        }

        const active = this.activeKeyVoices.get(code);
        if (active) {
          this.triggerNoteOff(active.midiNote, code);
          this.activeKeyVoices.delete(code);
        }
      }
    });

    // Window blur safety
    window.addEventListener('blur', () => {
      this.stopAllNotes();
    });
  }

  setSustainPedal(active) {
    this.sustainPedalActive = active;
    const pedalBtn = document.getElementById('sustain-pedal-btn');
    if (pedalBtn) {
      if (active) {
        pedalBtn.classList.add('active');
        pedalBtn.style.boxShadow = '0 0 15px #8B5CF6';
      } else {
        pedalBtn.classList.remove('active');
        pedalBtn.style.boxShadow = '';
      }
    }

    if (!active) {
      // Release all voices that were held solely by the sustain pedal
      this.sustainedVoices.forEach(voice => {
        try { voice.stop(); } catch (e) {}
      });
      this.sustainedVoices = [];
    }
  }

  toggleSustainPedal() {
    this.setSustainPedal(!this.sustainPedalActive);
  }

  triggerNoteOn(midiNote, velocity = 0.8, sourceId = 'default') {
    const inst = this.currentInstrument || (window.instrumentManager ? window.instrumentManager.currentInstrument : null);
    if (!inst) return null;

    // Highlight key visually
    this._setKeyVisualState(midiNote, true);

    // Determine destination node: route to armed track's channel strip if available
    let destNode = null;
    if (window.mixerEngine && window.trackManager) {
      const armed = window.trackManager.tracks.find(t => t.isArmed) || window.trackManager.tracks.find(t => t.id === window.trackManager.selectedTrackId);
      if (armed) {
        destNode = window.mixerEngine.getTrackInputNode(armed.id);
      }
    }

    // Play note via soundfont manager
    const voice = window.soundFontManager.playNote(inst, midiNote, velocity, destNode);

    if (voice) {
      this.activeMidiVoices.set(`${sourceId}_${midiNote}`, voice);
    }

    // Capture in recording engine if recording is in progress
    if (window.recordingEngine && window.recordingEngine.isRecording) {
      window.recordingEngine.recordNoteOn(inst.id, midiNote, velocity);
    }

    // Notify listeners (Tutorials, Music Lab, Note Detectors)
    const noteInfo = window.noteMapper.getNoteInfoFromMidi(midiNote);
    this.onNoteTriggerCallbacks.forEach(cb => {
      try { cb({ type: 'noteOn', midiNote, velocity, noteInfo, instrument: inst }); } catch (e) {}
    });

    return voice;
  }

  triggerNoteOff(midiNote, sourceId = 'default') {
    const key = `${sourceId}_${midiNote}`;
    const voice = this.activeMidiVoices.get(key);

    this._setKeyVisualState(midiNote, false);

    if (voice) {
      if (this.sustainPedalActive) {
        this.sustainedVoices.push(voice);
      } else {
        voice.stop();
      }
      this.activeMidiVoices.delete(key);
    }

    // Recording engine note-off
    if (window.recordingEngine && window.recordingEngine.isRecording) {
      window.recordingEngine.recordNoteOff(midiNote);
    }

    this.onNoteTriggerCallbacks.forEach(cb => {
      try { cb({ type: 'noteOff', midiNote }); } catch (e) {}
    });
  }

  stopAllNotes() {
    this.activeMidiVoices.forEach(voice => {
      try { voice.stop(0.05); } catch (e) {}
    });
    this.activeMidiVoices.clear();
    this.activeKeyVoices.clear();
    this.sustainedVoices.forEach(voice => {
      try { voice.stop(0.05); } catch (e) {}
    });
    this.sustainedVoices = [];
    this.pressedKeys.clear();

    // Clear visual highlights
    if (this.containerEl) {
      const activeKeys = this.containerEl.querySelectorAll('.piano-key.active');
      activeKeys.forEach(k => k.classList.remove('active'));
    }
  }

  onNoteTrigger(cb) {
    this.onNoteTriggerCallbacks.push(cb);
  }

  _setKeyVisualState(midiNote, isActive) {
    if (!this.containerEl) return;
    const keyEl = this.containerEl.querySelector(`[data-midi="${midiNote}"]`);
    if (keyEl) {
      if (isActive) {
        keyEl.classList.add('active');
      } else {
        keyEl.classList.remove('active');
      }
    }
  }

  _bindMidiSupport() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(
        midiAccess => {
          console.log('[KeyboardController] Web MIDI Access granted.');
          const inputs = midiAccess.inputs.values();
          for (let input of inputs) {
            input.onmidimessage = (msg) => this._handleMidiMessage(msg);
          }
          midiAccess.onstatechange = (e) => {
            if (e.port.type === 'input' && e.port.state === 'connected') {
              e.port.onmidimessage = (msg) => this._handleMidiMessage(msg);
            }
          };
        },
        () => console.log('[KeyboardController] Web MIDI not available or permission denied.')
      );
    }
  }

  _handleMidiMessage(msg) {
    const [status, note, velocity] = msg.data;
    const command = status >> 4;
    if (command === 9 && velocity > 0) { // Note On
      window.audioEngine.ensureContext().then(() => {
        this.triggerNoteOn(note, velocity / 127, 'midi_hardware');
      });
    } else if (command === 8 || (command === 9 && velocity === 0)) { // Note Off
      this.triggerNoteOff(note, 'midi_hardware');
    } else if (command === 11 && note === 64) { // Damper pedal
      this.setSustainPedal(velocity > 63);
    }
  }

  _updateVelocityUI() {
    const slider = document.getElementById('velocity-slider');
    const valText = document.getElementById('velocity-value-text');
    const pct = Math.round(window.noteMapper.velocity * 100);
    if (slider) slider.value = pct;
    if (valText) valText.textContent = `${pct}%`;
  }

  _showToast(msg) {
    const toast = document.getElementById('studio-toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => toast.classList.remove('show'), 2000);
    }
  }
}

window.keyboardController = new KeyboardController();
