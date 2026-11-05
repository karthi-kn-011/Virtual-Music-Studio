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
    this._initSidebar();
    this._initStatusBar();

    // 2. Audio Engine initial status update (complies with browser autoplay policy)
    if (window.audioEngine) {
      window.audioEngine._updateAudioStateUI();
    }

    // 3. Initialize subsystems safely in independent resilient blocks
    try {
      if (window.instrumentManager) await window.instrumentManager.init();
    } catch (e) { console.error('[App] InstrumentManager init error:', e); }

    try {
      if (window.keyboardController) {
        window.keyboardController.init(document.getElementById('studio-piano-keys'));
        const scroller = document.getElementById('piano-keyboard-scroller');
        if (scroller) scroller.scrollLeft = 0;
      }
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

    try {
      if (window.themeManager) window.themeManager.init();
    } catch (e) { console.error('[App] ThemeManager init error:', e); }

    // 4. Render 24-instrument catalog grid
    this.renderInstrumentsView();

    // 5. Bind master toolbar, effects rack, visualizer, modals, and unlock listeners
    this._bindTopToolbar();
    this._bindEffectsRack();
    this._bindVisualizer();
    this._bindModals();
    this._bindGlobalUserGestureUnlock();
    this.initDashboard();

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

    // Ensure application body and views container are locked at x = 0
    const dawBody = document.querySelector('.daw-body');
    if (dawBody) dawBody.scrollLeft = 0;
    const viewsContainer = document.getElementById('main-views-container');
    if (viewsContainer) {
      viewsContainer.scrollLeft = 0;
      viewsContainer.scrollTop = 0;
    }

    // View specific updates & rendering
    if (target === 'studio') {
      this.renderDashboardRecentProjects();
      this.updateDashboardSession();
      if (window.keyboardController) {
        window.keyboardController.updateKeyLabels();
      }
    } else if (target === 'mixer' && window.mixerEngine) {
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

  _initSidebar() {
    const sidebar = document.getElementById('daw-sidebar');
    const dawBody = document.querySelector('.daw-body');
    const toggleBtn = document.getElementById('btn-sidebar-collapse');
    if (!sidebar || !toggleBtn) return;

    // Check saved collapse state
    const isCollapsed = localStorage.getItem('vms_sidebar_collapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      if (dawBody) dawBody.classList.add('sidebar-collapsed');
      toggleBtn.textContent = '▶';
    }

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      if (dawBody) dawBody.classList.toggle('sidebar-collapsed', collapsed);
      toggleBtn.textContent = collapsed ? '▶' : '◀';
      localStorage.setItem('vms_sidebar_collapsed', collapsed ? 'true' : 'false');
    });
  }

  _initStatusBar() {
    const audioDot = document.getElementById('statusbar-audio-dot');
    const audioStateText = document.getElementById('statusbar-audio-state');
    const playheadPos = document.getElementById('statusbar-playhead-pos');
    const projectName = document.getElementById('statusbar-project-name');
    const instrumentInfo = document.getElementById('statusbar-instrument-info');

    // Audio status sync
    const updateAudioStatus = (state) => {
      if (audioDot && audioStateText) {
        if (state === 'running') {
          audioDot.className = 'statusbar-dot running';
          const khz = window.audioEngine && window.audioEngine.ctx ? Math.round(window.audioEngine.ctx.sampleRate / 1000) : 44;
          audioStateText.textContent = `Web Audio: Active (${khz}kHz)`;
        } else if (state === 'suspended') {
          audioDot.className = 'statusbar-dot locked';
          audioStateText.textContent = 'Web Audio: Suspended';
        } else {
          audioDot.className = 'statusbar-dot locked';
          audioStateText.textContent = 'Web Audio: Locked';
        }
      }
    };

    if (window.audioEngine) {
      window.audioEngine.onStateChange(updateAudioStatus);
      if (window.audioEngine.ctx) {
        updateAudioStatus(window.audioEngine.ctx.state);
      }
    }

    // Project name sync
    const projInput = document.getElementById('project-name-input');
    if (projInput && projectName) {
      projectName.textContent = projInput.value;
      projInput.addEventListener('input', (e) => {
        projectName.textContent = e.target.value || 'Untitled Symphony';
      });
    }

    // Instrument info sync
    const updateInstStatus = () => {
      if (!instrumentInfo) return;
      const instObj = window.instrumentManager ? window.instrumentManager.currentInstrument : null;
      let instName = 'Classical Piano';
      if (instObj) {
        if (typeof instObj === 'string') {
          instName = instObj;
        } else if (instObj.name) {
          instName = instObj.name;
        }
      }
      const oct = window.noteMapper ? window.noteMapper.baseOctave : 4;
      const octave = `C${oct}–C${oct + 1}`;
      let velPct = 85;
      if (window.noteMapper && typeof window.noteMapper.velocity === 'number') {
        velPct = Math.round(window.noteMapper.velocity * 100);
      }
      instrumentInfo.textContent = `${instName} • ${octave} • Velocity ${velPct}%`;
    };

    this.updateStatusInstrument = updateInstStatus;

    // Listen for instrument changes
    if (window.instrumentManager) {
      window.instrumentManager.onInstrumentChange(() => updateInstStatus());
    }

    // Velocity slider sync
    const velSlider = document.getElementById('velocity-slider');
    const velValText = document.getElementById('velocity-value-text');
    if (velSlider) {
      velSlider.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value, 10);
        if (window.noteMapper) window.noteMapper.velocity = pct / 100;
        if (velValText) velValText.textContent = `${pct}%`;
        updateInstStatus();
      });
    }

    // Playhead position RAF loop with dirty-check caching (avoids 60fps layout thrashing when paused)
    let lastFormattedTime = '';
    const updatePlayhead = () => {
      if (playheadPos && window.trackManager) {
        const t = window.trackManager.currentTime || 0;
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 100);
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        if (formatted !== lastFormattedTime) {
          lastFormattedTime = formatted;
          playheadPos.textContent = formatted;
        }
      }
      requestAnimationFrame(updatePlayhead);
    };
    requestAnimationFrame(updatePlayhead);

    // Initial instrument update
    setTimeout(updateInstStatus, 500);
  }

  _bindTopToolbar() {
    // Enable Audio unlock button
    const enableBtn = document.getElementById('btn-enable-audio');
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        try {
          await window.audioEngine.unlockAudio();
          this.showToast('Audio Engine Unlocked: Audio Active');
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

    // BPM Controller with immediate live synchronisation
    const bpmInput = document.getElementById('studio-bpm-input');
    if (bpmInput) {
      const handleBpm = (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && window.trackManager) {
          window.trackManager.setBpm(val);
        }
      };
      bpmInput.addEventListener('input', handleBpm);
      bpmInput.addEventListener('change', handleBpm);
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

    // Octave Shift Buttons in studio header (Centralized routing)
    const octDownBtn = document.getElementById('btn-octave-down');
    if (octDownBtn) {
      octDownBtn.onclick = (e) => {
        e.preventDefault();
        if (window.keyboardController) {
          window.keyboardController.shiftOctave(-1);
        }
      };
    }

    const octUpBtn = document.getElementById('btn-octave-up');
    if (octUpBtn) {
      octUpBtn.onclick = (e) => {
        e.preventDefault();
        if (window.keyboardController) {
          window.keyboardController.shiftOctave(1);
        }
      };
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
      document.querySelectorAll(`[id="${id}"]`).forEach(el => {
        el.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (window.studioEffects) {
            window.studioEffects.setParam(paramKey, val);
          }
          if (window.mixerEngine && window.mixerEngine.ctx) {
            if (paramKey === 'reverbWet' && window.mixerEngine.auxReverb.returnGain) {
              window.mixerEngine.auxReverb.returnGain.gain.setTargetAtTime(val, window.mixerEngine.ctx.currentTime, 0.05);
            } else if (paramKey === 'delayWet' && window.mixerEngine.auxDelay.returnGain) {
              window.mixerEngine.auxDelay.returnGain.gain.setTargetAtTime(val, window.mixerEngine.ctx.currentTime, 0.05);
            }
          }
          // Synchronize mirrored controls across views
          document.querySelectorAll(`[id="${id}"]`).forEach(sibling => {
            if (sibling !== el) sibling.value = val;
          });
        });
      });
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
    const modeText = document.getElementById('v-mode-text');
    const modeIcon = document.querySelector('.v-mode-icon');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.visualizerMode = this.visualizerMode === 'frequency' ? 'wave' : 'frequency';
        if (modeText) modeText.textContent = this.visualizerMode === 'frequency' ? 'Spectrum' : 'Waveform';
        if (modeIcon) modeIcon.textContent = this.visualizerMode === 'frequency' ? '📊' : '〰️';
      });
    }

    const freqData = new Uint8Array(128);
    const waveData = new Uint8Array(128);
    let idleAngle = 0;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.visualizerCanvas.getBoundingClientRect();
      const displayWidth = rect.width || 220;
      const displayHeight = rect.height || 52;
      const targetW = Math.floor(displayWidth * dpr);
      const targetH = Math.floor(displayHeight * dpr);
      if (this.visualizerCanvas.width !== targetW || this.visualizerCanvas.height !== targetH) {
        this.visualizerCanvas.width = targetW;
        this.visualizerCanvas.height = targetH;
      }
    };
    resizeCanvas();
    let resizeRafId = null;
    window.addEventListener('resize', () => {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(resizeCanvas);
    });

    const draw = () => {
      requestAnimationFrame(draw);
      if (!this.visualizerCanvas || !this.visualizerCtx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = this.visualizerCanvas.width / dpr;
      const h = this.visualizerCanvas.height / dpr;
      const ctx = this.visualizerCtx;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Check if audio context is running and producing sound
      const isAudioRunning = window.audioEngine && window.audioEngine.ctx && window.audioEngine.ctx.state === 'running';

      let hasSignal = false;
      if (isAudioRunning && window.audioEngine.analyser) {
        if (this.visualizerMode === 'frequency') {
          window.audioEngine.getAnalyserData(freqData);
          for (let i = 0; i < 32; i++) {
            if (freqData[i * 2] > 6) { hasSignal = true; break; }
          }
        } else {
          window.audioEngine.getWaveformData(waveData);
          for (let i = 0; i < 32; i++) {
            if (Math.abs(waveData[i * 4] - 128) > 3) { hasSignal = true; break; }
          }
        }
      }

      // Refresh cached computed accent every ~40 frames to avoid layout thrashing
      if (this.visualizerFrameCount === undefined) {
        this.visualizerFrameCount = 0;
        this.cachedAcc = '#8057D9';
        this.cachedAcc2 = '#477DD0';
      }
      this.visualizerFrameCount++;
      if (this.visualizerFrameCount % 40 === 0) {
        const computed = getComputedStyle(document.documentElement);
        this.cachedAcc = computed.getPropertyValue('--acc').trim() || '#8057D9';
        this.cachedAcc2 = computed.getPropertyValue('--acc2').trim() || '#477DD0';
      }

      const primaryColor = this.cachedAcc;
      const lightColor = this.cachedAcc2;
      const darkColor = 'rgba(7, 19, 33, 0.85)';

      if (!hasSignal) {
        // Dynamic Ambient Idle Animation (breathing spectrum bars or sine wave glow)
        idleAngle += 0.035;
        if (this.visualizerMode === 'frequency') {
          const barCount = 36;
          const barWidth = w / barCount;
          for (let i = 0; i < barCount; i++) {
            const wave = Math.sin(idleAngle + (i * 0.28)) * 0.5 + 0.5;
            const barHeight = Math.max(3, wave * (h * 0.4) + 2);
            const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
            grad.addColorStop(0, lightColor);
            grad.addColorStop(1, 'rgba(139, 92, 246, 0.08)');
            ctx.fillStyle = grad;
            ctx.fillRect(i * barWidth + 1, h - barHeight, barWidth - 2, barHeight);
          }
        } else {
          ctx.beginPath();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = primaryColor;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 6;
          for (let x = 0; x < w; x += 2) {
            const y = (h / 2) + Math.sin(idleAngle + (x * 0.045)) * (h * 0.2);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Active Real-Time DSP Audio Visualization
        if (this.visualizerMode === 'frequency') {
          const barCount = 36;
          const barWidth = w / barCount;
          for (let i = 0; i < barCount; i++) {
            const dataIdx = Math.floor((i / barCount) * (freqData.length * 0.65));
            const val = freqData[dataIdx] / 255.0;
            const barHeight = Math.max(3, val * (h - 4));

            const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
            grad.addColorStop(0, lightColor);
            grad.addColorStop(0.5, primaryColor);
            grad.addColorStop(1, darkColor);

            ctx.fillStyle = grad;
            ctx.fillRect(i * barWidth + 1, h - barHeight, barWidth - 2, barHeight);
          }
        } else {
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.strokeStyle = primaryColor;
          ctx.shadowColor = lightColor;
          ctx.shadowBlur = 8;

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
          ctx.shadowBlur = 0;
        }
      }

      ctx.restore();
    };

    draw();
  }

  /* ==================== STUDIO HOME DASHBOARD ==================== */
  initDashboard() {
    this.renderDashboardRecentProjects();
    this.updateDashboardSession();

    // Bind New Project Button in Dashboard
    const newProjBtn = document.getElementById('dash-btn-new-project');
    if (newProjBtn) {
      newProjBtn.addEventListener('click', () => {
        if (window.projectManager) {
          window.projectManager.newProject();
          this.renderDashboardRecentProjects();
          this.updateDashboardSession();
          this.showToast('Created New Blank Project');
        }
      });
    }

    // Bind Instant Record Tile
    const recTile = document.getElementById('dash-tile-record');
    if (recTile) {
      recTile.addEventListener('click', () => {
        const recBtn = document.getElementById('transport-record-btn');
        if (recBtn) recBtn.click();
      });
    }

    // Bind Piano Roll Tile
    const prTile = document.getElementById('dash-tile-pianoroll');
    if (prTile) {
      prTile.addEventListener('click', () => {
        if (window.pianoRoll && window.trackManager && window.trackManager.tracks.length > 0) {
          window.pianoRoll.openTrack(window.trackManager.tracks[0]);
        } else {
          window.navigateTo('arranger');
        }
      });
    }

    // Bind Tutorial Recording Quick Tip
    const tipRec = document.getElementById('dash-tip-rec');
    if (tipRec) {
      tipRec.addEventListener('click', () => {
        window.navigateTo('tutorials');
        if (window.tutorialManager) {
          const recTut = window.tutorialManager.tutorials.find(t => t.id === 'intro_qwerty') || window.tutorialManager.tutorials[0];
          if (recTut) window.tutorialManager.startTutorial(recTut.id);
        }
      });
    }

    // Subscribe to state changes for real-time live session updates
    if (window.instrumentManager) {
      window.instrumentManager.onInstrumentChange(() => this.updateDashboardSession());
    }

    if (window.trackManager) {
      window.trackManager.onBpmChange(() => this.updateDashboardSession());
    }

    if (window.audioEngine) {
      window.audioEngine.onStateChange(() => this.updateDashboardSession());
    }

    // Refresh dashboard projects on save
    const saveBtn = document.getElementById('btn-save-project');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        setTimeout(() => {
          this.renderDashboardRecentProjects();
          this.updateDashboardSession();
        }, 300);
      });
    }
  }

  async renderDashboardRecentProjects() {
    const listEl = document.getElementById('dash-recent-projects-list');
    if (!listEl) return;

    if (!window.projectManager || !window.projectManager.db) {
      listEl.innerHTML = '<div class="dash-empty-state">Project database initializing...</div>';
      return;
    }

    try {
      const projects = await window.projectManager.getAllProjects();
      if (!projects || projects.length === 0) {
        listEl.innerHTML = `
          <div class="dash-empty-state">
            <span>No saved projects yet.</span><br>
            <button class="btn btn-xs btn-primary" style="margin-top: 6px;" onclick="window.projectManager.saveProject('My First Symphony').then(() => window.app.renderDashboardRecentProjects())">Save Current Project</button>
          </div>
        `;
        return;
      }

      // Sort by updatedAt descending, show top 4
      const recent = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);

      listEl.innerHTML = '';
      recent.forEach(p => {
        const item = document.createElement('div');
        item.className = 'dash-project-item';
        item.title = `Click to load: "${p.name}"`;
        const updatedDate = new Date(p.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
        const tracksCount = p.tracks ? p.tracks.length : 1;

        item.innerHTML = `
          <div class="dash-project-info">
            <span class="dash-project-name">🎵 ${this._escapeHtml(p.name)}</span>
            <span class="dash-project-meta">${tracksCount} tracks • ${p.bpm || 120} BPM • ${updatedDate}</span>
          </div>
          <button class="btn btn-xs btn-ghost" style="padding: 2px 6px;">Load ▶</button>
        `;

        item.addEventListener('click', async () => {
          await window.projectManager.loadProject(p.id);
          this.updateDashboardSession();
          this.showToast(`Loaded Project: "${p.name}"`);
        });

        listEl.appendChild(item);
      });
    } catch (e) {
      console.warn('[App] Dashboard projects load note:', e);
      listEl.innerHTML = '<div class="dash-empty-state">Recent projects available upon saving.</div>';
    }
  }

  updateDashboardSession() {
    // 1. Active Instrument
    const instEl = document.getElementById('dash-session-inst');
    if (instEl) {
      const curInst = window.instrumentManager && window.instrumentManager.currentInstrument;
      instEl.textContent = curInst ? curInst.name : 'Classical Piano';
    }

    // 2. Studio Tempo
    const bpmEl = document.getElementById('dash-session-bpm');
    if (bpmEl) {
      const bpm = window.trackManager ? window.trackManager.bpm : 120;
      bpmEl.textContent = `${bpm} BPM`;
    }

    // 3. Arranger Tracks
    const tracksEl = document.getElementById('dash-session-tracks');
    if (tracksEl) {
      const count = window.trackManager && window.trackManager.tracks ? window.trackManager.tracks.length : 1;
      tracksEl.textContent = `${count} Track${count === 1 ? '' : 's'} Active`;
    }

    // 4. Master Engine
    const engineEl = document.getElementById('dash-session-engine');
    if (engineEl) {
      const isRunning = window.audioEngine && window.audioEngine.ctx && window.audioEngine.ctx.state === 'running';
      if (isRunning) {
        engineEl.textContent = '44.1 kHz • Active';
        engineEl.style.color = '#10B981';
      } else {
        engineEl.textContent = 'Audio: Locked';
        engineEl.style.color = 'var(--text-muted)';
      }
    }

    // 5. Current Project Name
    const projEl = document.getElementById('dash-session-project');
    if (projEl) {
      const name = window.projectManager && window.projectManager.currentProject ? window.projectManager.currentProject.name : 'Untitled Symphony';
      projEl.textContent = name;
    }
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
