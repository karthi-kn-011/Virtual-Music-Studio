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
    this._isUserScrollingManually = false;
    this._manualScrollTimer = null;
    this._scrollTimer = null;
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

    // Reset initial keyboard scroll position to the actual leftmost position (A0)
    const scrollContainer = this.getScrollContainer();
    if (scrollContainer) {
      scrollContainer.scrollLeft = 0;
    }

    // Bind accessible nav arrow buttons, wheel scrolling, and drag handling
    this._bindScrollControls();
  }

  /**
   * Helper to resolve the scroll container
   */
  getScrollContainer() {
    if (!this.containerEl) return document.getElementById('piano-keyboard-scroller');
    return this.containerEl.closest('.piano-keyboard-scroll-container') || document.getElementById('piano-keyboard-scroller');
  }

  /**
   * Binds mouse wheel, touchpad gestures, and drag scrolling
   */
  _markManualScroll() {
    this._isUserScrollingManually = true;
    if (this._manualScrollTimer) clearTimeout(this._manualScrollTimer);
    this._manualScrollTimer = setTimeout(() => {
      this._isUserScrollingManually = false;
    }, 600);
  }

  /**
   * Binds mouse wheel, touchpad gestures, and drag scrolling
   */
  _bindScrollControls() {
    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer) return;

    // Wheel listener: Shift + mouse wheel, touchpad gestures, and translating deltaY to horizontal scroll
    scrollContainer.addEventListener('wheel', (e) => {
      this._markManualScroll();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Native horizontal gesture (touchpad or horizontal scroll wheel)
        return;
      }
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollContainer.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // Mouse drag-to-scroll (grab & drag on empty container areas or with middle click)
    let isMouseDown = false;
    let startX = 0;
    let startScrollLeft = 0;

    scrollContainer.addEventListener('mousedown', (e) => {
      const isMiddle = e.button === 1;
      const isPaddingArea = e.target === scrollContainer || e.target === this.containerEl || e.target.classList.contains('piano-keys-wrapper');

      if (isMiddle || isPaddingArea) {
        this._markManualScroll();
        isMouseDown = true;
        startX = e.pageX - scrollContainer.offsetLeft;
        startScrollLeft = scrollContainer.scrollLeft;
        scrollContainer.classList.add('is-dragging');
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      this._markManualScroll();
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollContainer.scrollLeft = startScrollLeft - walk;
    });

    window.addEventListener('mouseup', () => {
      if (isMouseDown) {
        isMouseDown = false;
        scrollContainer.classList.remove('is-dragging');
        this._markManualScroll();
      }
    });

    // Touch horizontal swipe on the scroller container
    let touchStartX = 0;
    let touchStartScrollLeft = 0;
    let isTouchingContainer = false;

    scrollContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && (e.target === scrollContainer || e.target === this.containerEl || e.target.classList.contains('piano-keys-wrapper'))) {
        this._markManualScroll();
        isTouchingContainer = true;
        touchStartX = e.touches[0].pageX;
        touchStartScrollLeft = scrollContainer.scrollLeft;
      }
    }, { passive: true });

    scrollContainer.addEventListener('touchmove', (e) => {
      if (!isTouchingContainer || e.touches.length !== 1) return;
      this._markManualScroll();
      const touchX = e.touches[0].pageX;
      const diff = touchStartX - touchX;
      scrollContainer.scrollLeft = touchStartScrollLeft + diff;
    }, { passive: true });

    scrollContainer.addEventListener('touchend', () => {
      isTouchingContainer = false;
      this._markManualScroll();
    }, { passive: true });
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
          <span class="note-name">${noteInfo.pitchName === 'C' || !noteInfo.isBlack ? noteInfo.noteName : ''}</span>
          ${qwerty ? `<span class="qwerty-hint active-hint">${qwerty}</span>` : ''}
        `;
      }
    });

    // Update octave UI display
    const octDisplay = document.getElementById('current-octave-display');
    if (octDisplay) {
      octDisplay.textContent = `C${window.noteMapper.baseOctave} - C${window.noteMapper.baseOctave + 1}`;
    }

    // Keep octave button states synchronized with boundaries
    this._updateOctaveButtonStates();
  }

  /**
   * Calculates the exact horizontal scroll coordinate to comfortably center the specified octave
   * Accounts for rendered element positions, current scroll offset, viewport width, and boundaries.
   */
  _calculateOctaveScrollTarget(octave) {
    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer || !this.containerEl) return null;

    const startMidi = (octave + 1) * 12; // C of base octave
    const startKey = this.containerEl.querySelector(`[data-midi="${startMidi}"]`);
    if (!startKey) return null;

    const endMidi = Math.min(this.endNote, startMidi + 12); // C of upper octave
    const endKey = this.containerEl.querySelector(`[data-midi="${endMidi}"]`);

    const containerRect = scrollContainer.getBoundingClientRect();
    const startRect = startKey.getBoundingClientRect();
    const currentScrollLeft = scrollContainer.scrollLeft;

    // Actual horizontal pixel coordinate of start key relative to scrollable canvas
    const startContentX = (startRect.left - containerRect.left) + currentScrollLeft;

    let endContentX;
    if (endKey) {
      const endRect = endKey.getBoundingClientRect();
      endContentX = (endRect.right - containerRect.left) + currentScrollLeft;
    } else {
      endContentX = startContentX + startRect.width;
    }

    const octaveWidth = endContentX - startContentX;
    const octaveCenter = startContentX + (octaveWidth / 2);
    const viewportWidth = scrollContainer.clientWidth;

    let targetPosition;
    if (viewportWidth >= octaveWidth) {
      // Comfortably center the octave within the available container width
      targetPosition = octaveCenter - (viewportWidth / 2);
    } else {
      // Narrow screens: align octave start with comfortable 16px inset
      targetPosition = startContentX - 16;
    }

    const maxScroll = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
    return Math.max(0, Math.min(maxScroll, Math.round(targetPosition)));
  }

  /**
   * Smoothly scrolls the piano keyboard container to make the active octave visible
   */
  scrollKeyboardToOctave(octave, behavior = 'smooth') {
    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer) return;

    const targetPosition = this._calculateOctaveScrollTarget(octave);
    if (targetPosition === null) return;

    // Prevent competing animation loops during rapid octave clicking
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
    }

    // Perform smooth horizontal scroll
    scrollContainer.scrollTo({
      left: targetPosition,
      behavior: behavior
    });

    // Verification settle pass: ensures final keyboard position locks accurately to latest selected octave
    this._scrollTimer = setTimeout(() => {
      if (!this._isUserScrollingManually) {
        const recomputed = this._calculateOctaveScrollTarget(window.noteMapper ? window.noteMapper.baseOctave : octave);
        if (recomputed !== null && Math.abs(scrollContainer.scrollLeft - recomputed) > 4) {
          scrollContainer.scrollTo({ left: recomputed, behavior: 'smooth' });
        }
      }
    }, 320);
  }

  /**
   * Centralized Octave Shifting Engine
   * Single source of truth: updates noteMapper, key labels, status bar, and smoothly scrolls to view
   */
  shiftOctave(delta) {
    const current = window.noteMapper ? window.noteMapper.baseOctave : 4;
    return this.setOctave(current + delta, true);
  }

  setOctave(targetOctave, triggerAutoScroll = true) {
    if (!window.noteMapper) return 4;

    const previousOctave = window.noteMapper.baseOctave;
    const newOctave = window.noteMapper.setOctave(targetOctave);

    // 1. Update all visual QWERTY badges and note names
    this.updateKeyLabels();

    // 2. Update bottom status bar
    if (window.app && typeof window.app.updateStatusInstrument === 'function') {
      window.app.updateStatusInstrument();
    }

    // 3. Update button boundary states
    this._updateOctaveButtonStates();

    // 4. Smoothly scroll piano keyboard to reveal newly selected octave
    if (triggerAutoScroll) {
      this.scrollKeyboardToOctave(newOctave, 'smooth');
    }

    // 5. User feedback toast
    if (newOctave !== previousOctave) {
      const dir = newOctave > previousOctave ? 'Higher' : 'Lower';
      this._showToast(`Octave ${dir}: C${newOctave} - C${newOctave + 1}`);
    } else if (targetOctave > 7) {
      this._showToast('Maximum Octave Reached: C7 - C8');
    } else if (targetOctave < 1) {
      this._showToast('Minimum Octave Reached: C1 - C2');
    }

    return newOctave;
  }

  _updateOctaveButtonStates() {
    const current = window.noteMapper ? window.noteMapper.baseOctave : 4;
    const downBtn = document.getElementById('btn-octave-down');
    const upBtn = document.getElementById('btn-octave-up');

    if (downBtn) {
      const isMin = current <= 1;
      downBtn.disabled = isMin;
      downBtn.style.opacity = isMin ? '0.45' : '1';
      downBtn.style.cursor = isMin ? 'not-allowed' : 'pointer';
    }

    if (upBtn) {
      const isMax = current >= 7;
      upBtn.disabled = isMax;
      upBtn.style.opacity = isMax ? '0.45' : '1';
      upBtn.style.cursor = isMax ? 'not-allowed' : 'pointer';
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

      // Special action keys - centralized octave shifting
      if (code === 'KeyZ') {
        e.preventDefault();
        this.shiftOctave(-1);
        return;
      }

      if (code === 'KeyX') {
        e.preventDefault();
        this.shiftOctave(1);
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
    if (window.app && window.app.updateStatusInstrument) {
      window.app.updateStatusInstrument();
    }
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
