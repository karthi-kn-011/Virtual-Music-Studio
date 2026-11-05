/**
 * Virtual Music Studio - Main Application Controller
 * Orchestrates all subsystems, navigation views, real-time master visualizer,
 * UI bindings, modals, and first-time onboarding.
 */

// Global Centralized Navigation Function
window.navigateTo = function(viewName) {
  const aliasMap = {
    'mixer': 'mixer',
    'console': 'mixer',
    'drums': 'drum-machine',
    'drum': 'drum-machine',
    'arranger': 'arranger',
    'timeline': 'arranger',
    'theory': 'music-lab',
    'lab': 'music-lab',
    'genre': 'genres',
    'tutorial': 'tutorials',
    'project': 'projects',
    'fx': 'effects',
    'chords': 'chords',
    'chord': 'chords',
    'progression': 'chords',
    'arpeggiator': 'arpeggiator',
    'arp': 'arpeggiator',
    'mastering': 'mastering',
    'master': 'mastering'
  };

  const target = aliasMap[viewName] || viewName;

  if (window.app && typeof window.app.switchView === 'function') {
    window.app.switchView(target);
  } else {
    // Immediate DOM fallback
    document.querySelectorAll('.nav-link').forEach(link => {
      const match = link.dataset.view === target || link.id === `nav-${target}`;
      link.classList.toggle('active', match);
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
      const match = panel.id === `view-${target}`;
      panel.classList.toggle('active', match);
      panel.style.display = match ? 'flex' : 'none';
    });
  }
};

class VirtualMusicStudioApp {
  constructor() {
    this.currentView = 'studio';
    this.visualizerCanvas = null;
    this.visualizerCtx = null;
    this.visualizerMode = 'frequency'; // 'frequency' or 'wave'
    this.isMetronomeOn = false;
    this.metronomeInterval = null;
    this.metronomeBeat = 0;
  }

  async init() {
    console.log('[App] Initializing Virtual Music Studio...');

    // 1. Immediately bind navigation so clicking any tab works without waiting
    this._bindNavigation();

    // 2. Audio Engine initial status update (complies with browser autoplay policy)
    if (window.audioEngine) {
      window.audioEngine._updateAudioStateUI();
    }

    // 3. Initialize subsystems safely in independent resilient blocks
    try {
      if (window.instrumentManager) await window.instrumentManager.init();
    } catch (e) { console.error('[App] InstrumentManager init error:', e); }

    try {
      if (window.keyboardController) window.keyboardController.init(document.getElementById('studio-piano-keys'));
    } catch (e) { console.error('[App] KeyboardController init error:', e); }

    try {
      if (window.trackManager) window.trackManager.init();
    } catch (e) { console.error('[App] TrackManager init error:', e); }

    try {
      if (window.pianoRoll) window.pianoRoll.init();
    } catch (e) { console.error('[App] PianoRoll init error:', e); }

    try {
      if (window.drumMachine) window.drumMachine.init(document.getElementById('drum-machine-container'));
    } catch (e) { console.error('[App] DrumMachine init error:', e); }

    try {
      if (window.musicTheoryLab) window.musicTheoryLab.init();
    } catch (e) { console.error('[App] MusicTheoryLab init error:', e); }

    try {
      if (window.genreManager) window.genreManager.init(document.getElementById('genres-container'));
    } catch (e) { console.error('[App] GenreManager init error:', e); }

    try {
      if (window.tutorialManager) window.tutorialManager.init(document.getElementById('tutorials-container'));
    } catch (e) { console.error('[App] TutorialManager init error:', e); }

    try {
      if (window.projectManager) await window.projectManager.init();
    } catch (e) { console.error('[App] ProjectManager init error:', e); }

    try {
      if (window.mixerEngine && window.audioEngine && window.audioEngine.ctx) {
        window.mixerEngine.init(window.audioEngine.ctx);
      }
    } catch (e) { console.error('[App] MixerEngine init error:', e); }

    // Phase 13 Subsystems Initializations
    try {
      if (window.arrangementManager) window.arrangementManager.init(document.getElementById('arrangement-workspace-bar'));
    } catch (e) { console.error('[App] ArrangementManager init error:', e); }

    try {
      if (window.clipManager) window.clipManager.init();
    } catch (e) { console.error('[App] ClipManager init error:', e); }

    try {
      if (window.automationEngine) window.automationEngine.init(document.getElementById('automation-lanes-mount'));
    } catch (e) { console.error('[App] AutomationEngine init error:', e); }

    try {
      if (window.chordGenerator) window.chordGenerator.init(document.getElementById('chord-generator-mount'));
    } catch (e) { console.error('[App] ChordGenerator init error:', e); }

    try {
      if (window.arpeggiatorEngine) window.arpeggiatorEngine.init(document.getElementById('arpeggiator-mount'));
    } catch (e) { console.error('[App] ArpeggiatorEngine init error:', e); }

    try {
      if (window.masteringEngine) {
        window.masteringEngine.initUI(document.getElementById('mastering-mount'));
        if (window.audioEngine && window.audioEngine.ctx) {
          window.masteringEngine.initAudioChain(window.audioEngine.ctx, null, window.audioEngine.destinationNode);
        }
      }
    } catch (e) { console.error('[App] MasteringEngine init error:', e); }

    // 4. Render 24-instrument catalog grid
    this.renderInstrumentsView();

    // 5. Bind master toolbar, effects rack, visualizer, modals, and unlock listeners
    this._bindTopToolbar();
    this._bindEffectsRack();
    this._bindVisualizer();
    this._bindModals();
    this._bindGlobalUserGestureUnlock();

    // Check first-time user onboarding
    if (!localStorage.getItem('vms_onboarded')) {
      this.openModal('onboarding-modal');
      localStorage.setItem('vms_onboarded', 'true');
    }

    console.log('[App] Virtual Music Studio fully loaded and ready.');
  }

  _bindGlobalUserGestureUnlock() {
    const unlockOnGesture = async () => {
      if (!window.audioEngine.isUnlocked) {
        try {
          await window.audioEngine.unlockAudio();
        } catch (e) {
          console.warn('[App] Gesture unlock notice:', e.message);
        }
      }
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
    };

    window.addEventListener('pointerdown', unlockOnGesture, { passive: true });
    window.addEventListener('keydown', unlockOnGesture, { passive: true });
  }

  switchView(viewName) {
    const aliasMap = {
      'mixer': 'mixer',
      'console': 'mixer',
      'drums': 'drum-machine',
      'drum': 'drum-machine',
      'arranger': 'arranger',
      'timeline': 'arranger',
      'theory': 'music-lab',
      'lab': 'music-lab',
      'genre': 'genres',
      'tutorial': 'tutorials',
      'project': 'projects',
      'fx': 'effects',
      'chords': 'chords',
      'chord': 'chords',
      'progression': 'chords',
      'arpeggiator': 'arpeggiator',
      'arp': 'arpeggiator',
      'mastering': 'mastering',
      'master': 'mastering'
    };
    const target = aliasMap[viewName] || viewName;
    this.currentView = target;

    console.log(`[App] Switching view to: "${target}"`);

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      const match = link.dataset.view === target || link.id === `nav-${target}`;
      link.classList.toggle('active', match);
    });

    // Update view panels and force explicit display styling
    document.querySelectorAll('.view-panel').forEach(panel => {
      const match = panel.id === `view-${target}`;
      panel.classList.toggle('active', match);
      panel.style.display = match ? 'flex' : 'none';
    });

    // View specific updates & rendering
    if (target === 'mixer' && window.mixerEngine) {
      window.mixerEngine.renderMixerUI();
      window.mixerEngine._updateInspectorUI();
    } else if (target === 'instruments') {
      this.renderInstrumentsView();
    } else if (target === 'arranger') {
      if (window.trackManager) window.trackManager.renderArrangerUI();
    } else if (target === 'projects') {
      if (window.projectManager) window.projectManager.renderProjectsList();
    } else if (target === 'drum-machine') {
      if (window.drumMachine) window.drumMachine.render();
    } else if (target === 'chords') {
      if (window.chordGenerator) window.chordGenerator.render();
    } else if (target === 'arpeggiator') {
      if (window.arpeggiatorEngine) window.arpeggiatorEngine.render();
    } else if (target === 'mastering') {
      if (window.masteringEngine) window.masteringEngine.render();
    } else if (target === 'music-lab') {
      if (window.musicTheoryLab) {
        window.musicTheoryLab.renderCircleOfFifths();
        window.musicTheoryLab.renderChordsList();
        window.musicTheoryLab.renderProgressions();
        window.musicTheoryLab.highlightScaleOnKeyboard();
      }
    } else if (target === 'genres') {
      if (window.genreManager) window.genreManager.render();
    } else if (target === 'tutorials') {
      if (window.tutorialManager) window.tutorialManager.render();
    } else if (target === 'studio') {
      if (window.keyboardController) {
        window.keyboardController.updateKeyLabels();
        window.keyboardController.scrollKeyboardToOctave(window.noteMapper ? window.noteMapper.baseOctave : 4);
      }
    }
  }

  renderInstrumentsView() {
    if (window.instrumentManager) {
      window.instrumentManager.renderCatalogue(document.getElementById('instruments-grid'));
    }
  }

  _bindNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) this.switchView(view);
      };
    });
  }

  _bindTopToolbar() {
    // Enable Audio unlock button
    const enableBtn = document.getElementById('btn-enable-audio');
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        try {
          await window.audioEngine.unlockAudio();
          this.showToast('Audio Engine Unlocked: 44.1kHz Interactive');
        } catch (err) {
          console.error('[App] Enable Audio click error:', err);
          this.showToast('Failed to enable audio: ' + err.message);
        }
      });
    }

    // Project Name edit
    const projName = document.getElementById('project-name-input');
    if (projName) {
      projName.addEventListener('change', (e) => {
        window.projectManager.saveProject(e.target.value);
      });
    }

    // New Project button
    const newBtn = document.getElementById('btn-new-project');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        if (confirm('Create new project? Unsaved changes will be cleared.')) {
          window.projectManager.newProject();
        }
      });
    }

    // Save Project button
    const saveBtn = document.getElementById('btn-save-project');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        window.projectManager.saveProject().then(() => {
          this.showToast('Project saved successfully to IndexedDB!');
        });
      });
    }

    // Export Audio (WAV) button
    const exportWavBtn = document.getElementById('btn-export-wav');
    if (exportWavBtn) {
      exportWavBtn.addEventListener('click', () => {
        window.exportManager.exportProjectAsWav();
      });
    }

    // Export MIDI button
    const exportMidiBtn = document.getElementById('btn-export-midi');
    if (exportMidiBtn) {
      exportMidiBtn.addEventListener('click', () => {
        window.exportManager.exportProjectAsMidi();
      });
    }

    // Transport buttons
    const playBtn = document.getElementById('transport-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        window.trackManager.togglePlay();
      });
    }

    const stopBtn = document.getElementById('transport-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        window.trackManager.stop();
        window.recordingEngine.stopRecording();
      });
    }

    const recordBtn = document.getElementById('transport-record-btn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => {
        if (window.recordingEngine.isRecording) {
          window.recordingEngine.stopRecording();
          recordBtn.classList.remove('recording');
        } else {
          window.recordingEngine.startRecording(0);
          recordBtn.classList.add('recording');
        }
      });
    }

    // Metronome Toggle
    const metronomeBtn = document.getElementById('metronome-btn');
    if (metronomeBtn) {
      metronomeBtn.addEventListener('click', () => {
        this.toggleMetronome();
      });
    }

    // BPM Controller
    const bpmInput = document.getElementById('studio-bpm-input');
    if (bpmInput) {
      bpmInput.addEventListener('change', (e) => {
        window.trackManager.setBpm(parseInt(e.target.value, 10));
      });
    }

    // Master Volume Slider
    const masterVolSlider = document.getElementById('master-volume-slider');
    if (masterVolSlider) {
      masterVolSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        window.audioEngine.setMasterVolume(val);
        const text = document.getElementById('master-volume-value');
        if (text) text.textContent = `${Math.round(val * 100)}%`;
      });
    }

    // Octave Shift Buttons in studio header
    const octDownBtn = document.getElementById('btn-octave-down');
    if (octDownBtn) {
      octDownBtn.addEventListener('click', () => {
        window.noteMapper.shiftOctave(-1);
        window.keyboardController.updateKeyLabels();
        window.keyboardController.scrollKeyboardToOctave(window.noteMapper.baseOctave);
      });
    }

    const octUpBtn = document.getElementById('btn-octave-up');
    if (octUpBtn) {
      octUpBtn.addEventListener('click', () => {
        window.noteMapper.shiftOctave(1);
        window.keyboardController.updateKeyLabels();
        window.keyboardController.scrollKeyboardToOctave(window.noteMapper.baseOctave);
      });
    }

    // Sustain Pedal button
    const sustainBtn = document.getElementById('sustain-pedal-btn');
    if (sustainBtn) {
      sustainBtn.addEventListener('click', () => {
        window.keyboardController.toggleSustainPedal();
      });
    }

    // Panic / Stop All button
    const panicBtn = document.getElementById('panic-btn');
    if (panicBtn) {
      panicBtn.addEventListener('click', () => {
        window.keyboardController.stopAllNotes();
        this.showToast('All audio voices silenced');
      });
    }

    // Fullscreen toggle
    const fsBtn = document.getElementById('btn-fullscreen-toggle');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Update active instrument hero card when changed
    window.instrumentManager.onInstrumentChange(inst => {
      const heroName = document.getElementById('current-instrument-name');
      const heroFamily = document.getElementById('current-instrument-family');
      const heroDesc = document.getElementById('current-instrument-desc');
      const heroIcon = document.getElementById('current-instrument-icon');

      if (heroName) heroName.textContent = inst.name;
      if (heroFamily) heroFamily.textContent = inst.family;
      if (heroDesc) heroDesc.textContent = inst.description;
      if (heroIcon) heroIcon.innerHTML = this._getInstrumentSvgIcon(inst.id);
    });
  }

  toggleMetronome() {
    this.isMetronomeOn = !this.isMetronomeOn;
    const btn = document.getElementById('metronome-btn');
    if (btn) btn.classList.toggle('active', this.isMetronomeOn);

    if (this.isMetronomeOn) {
      const bpm = window.trackManager ? window.trackManager.bpm : 120;
      const intervalMs = (60 / bpm) * 1000;
      this.metronomeBeat = 0;
      this.metronomeInterval = setInterval(() => {
        this.metronomeBeat = (this.metronomeBeat % 4) + 1;
        window.recordingEngine._playMetronomeTick(this.metronomeBeat === 1);
      }, intervalMs);
    } else {
      if (this.metronomeInterval) clearInterval(this.metronomeInterval);
    }
  }

  _bindEffectsRack() {
    const bindKnob = (id, paramKey) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          window.studioEffects.setParam(paramKey, parseFloat(e.target.value));
        });
      }
    };

    bindKnob('fx-reverb-wet', 'reverbWet');
    bindKnob('fx-reverb-time', 'reverbTime');
    bindKnob('fx-delay-time', 'delayTime');
    bindKnob('fx-delay-feedback', 'delayFeedback');
    bindKnob('fx-delay-wet', 'delayWet');
    bindKnob('fx-chorus-wet', 'chorusWet');
    bindKnob('fx-eq-low', 'eqLow');
    bindKnob('fx-eq-mid', 'eqMid');
    bindKnob('fx-eq-high', 'eqHigh');
    bindKnob('fx-filter-lp', 'filterLowPass');
    bindKnob('fx-filter-hp', 'filterHighPass');
  }

  _bindVisualizer() {
    this.visualizerCanvas = document.getElementById('master-analyser-canvas');
    if (!this.visualizerCanvas) return;
    this.visualizerCtx = this.visualizerCanvas.getContext('2d');

    const toggleBtn = document.getElementById('visualizer-toggle-mode');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.visualizerMode = this.visualizerMode === 'frequency' ? 'wave' : 'frequency';
      });
    }

    const freqData = new Uint8Array(256);
    const waveData = new Uint8Array(256);

    const draw = () => {
      requestAnimationFrame(draw);
      if (!window.audioEngine.analyser) return;

      const w = this.visualizerCanvas.width;
      const h = this.visualizerCanvas.height;
      const ctx = this.visualizerCtx;

      ctx.clearRect(0, 0, w, h);

      if (this.visualizerMode === 'frequency') {
        window.audioEngine.getAnalyserData(freqData);
        const barWidth = (w / 48);
        let x = 0;

        for (let i = 0; i < 48; i++) {
          const val = freqData[i * 4] / 255.0;
          const barHeight = val * h * 0.95;

          const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
          grad.addColorStop(0, '#A78BFA');
          grad.addColorStop(0.5, '#8B5CF6');
          grad.addColorStop(1, '#6D28D9');

          ctx.fillStyle = grad;
          ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      } else {
        window.audioEngine.getWaveformData(waveData);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#06B6D4';
        ctx.beginPath();

        const sliceWidth = w / waveData.length;
        let x = 0;

        for (let i = 0; i < waveData.length; i++) {
          const v = waveData[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }
        ctx.stroke();
      }
    };

    draw();
  }

  _bindModals() {
    // Open modal buttons
    document.querySelectorAll('[data-open-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openModal(btn.dataset.openModal);
      });
    });

    // Close modal buttons
    document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.closest('.modal-container').classList.remove('open');
        }
      });
    });
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('open');
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('open');
  }

  showToast(msg) {
    const toast = document.getElementById('studio-toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
    }
  }

  _getInstrumentSvgIcon(instrumentId) {
    // Transparent SVG illustrations tailored to each instrument category
    if (instrumentId.includes('piano')) {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M8 12h48v40H8z" rx="3" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M14 14h6v24h-6zm10 0h6v24h-6zm10 0h6v24h-6zm10 0h6v24h-6z" fill="currentColor"/><circle cx="50" cy="46" r="3" fill="#F59E0B"/></svg>`;
    } else if (instrumentId === 'organ') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M12 52V20h8v32zm12 0V12h8v40zm12 0V16h8v36zm12 0V24h8v28z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 52h44v4H10z" fill="currentColor"/></svg>`;
    } else if (instrumentId === 'accordion') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><rect x="8" y="14" width="12" height="36" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="44" y="14" width="12" height="36" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M20 18l6-4 6 4 6-4 6 4v28l-6 4-6-4-6 4-6-4z" fill="none" stroke="#F59E0B" stroke-width="2"/></svg>`;
    } else if (instrumentId.includes('guitar')) {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M48 10L38 20M32 26c-8-8-18-4-20 4s6 18 16 18 18-6 18-16c0-6-6-8-6-8z" stroke="currentColor" stroke-width="2.5" fill="none"/><circle cx="28" cy="36" r="4" fill="#F59E0B"/><path d="M38 20l14-14 4 4-14 14" stroke="currentColor" stroke-width="2"/></svg>`;
    } else if (instrumentId === 'harp') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M16 12c12 0 28 8 32 28v12H16z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M22 52V20M28 52V24M34 52V30M40 52V36" stroke="#06B6D4" stroke-width="1.8"/></svg>`;
    } else if (instrumentId === 'violin' || instrumentId === 'double_bass') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M32 8v48M24 20c-4 0-8 6-8 12s4 6 4 8-4 8 0 12 16 4 24 0c4-4 0-12 0-12s4-2 4-8-4-12-8-12" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="32" cy="38" r="3" fill="#F59E0B"/></svg>`;
    } else if (instrumentId === 'sitar' || instrumentId === 'oud' || instrumentId === 'koto') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><ellipse cx="24" cy="40" rx="14" ry="12" stroke="currentColor" stroke-width="2" fill="none"/><path d="M32 32L54 10l4 4-22 22" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="40" r="3" fill="#F59E0B"/><line x1="18" y1="46" x2="52" y2="12" stroke="#06B6D4" stroke-width="1.5"/></svg>`;
    } else if (instrumentId === 'glockenspiel' || instrumentId === 'steel_pan' || instrumentId === 'mixed_percussion') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><rect x="12" y="16" width="40" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="28" width="36" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="16" y="40" width="32" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="48" cy="24" r="5" fill="#F59E0B"/></svg>`;
    } else if (instrumentId === 'pan_flute') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M12 12v40M18 12v36M24 12v32M30 12v28M36 12v24M42 12v20M48 12v16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M10 20h42" stroke="#F59E0B" stroke-width="2"/></svg>`;
    } else if (instrumentId === 'saxophone' || instrumentId === 'brass_ensemble') {
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M20 12h12v24c0 8 6 14 14 14s10-4 10-10H46" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M54 36c4 0 6-6 6-10s-4-6-6-6v22z" fill="#F59E0B"/></svg>`;
    } else { // Clarinet, Oboe
      return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M28 8h8l4 44-8 4-8-4z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="32" cy="20" r="2" fill="#F59E0B"/><circle cx="32" cy="28" r="2" fill="#F59E0B"/><circle cx="32" cy="36" r="2" fill="#F59E0B"/><circle cx="32" cy="44" r="2" fill="#F59E0B"/></svg>`;
    }
  }
}

window.app = new VirtualMusicStudioApp();

// Boot application upon DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app.init().catch(err => {
    console.error('[App] Boot error:', err);
  });
});
