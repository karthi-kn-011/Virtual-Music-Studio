/**
 * Virtual Music Studio - Professional Drum Machine & Rhythm Programmer (Phase 13)
 * 11 Pro Drum Voices: Kick, Snare, Closed Hat, Open Hat, Clap, Rimshot, High Tom, Low Tom, Crash, Ride, Percussion.
 * Features:
 * - 16 / 32 Step toggle
 * - 4 Pattern Banks (A, B, C, D) with Bank Chaining (Song Mode)
 * - Per-step Velocity (0-127) and Probability (0-100%)
 * - Swing / Groove Presets (Straight, Light 16th, Heavy 16th, MPC 58%, Triplet)
 * - Per-voice Mute & Solo
 * - Drift-free Web Audio Clock Lookahead Scheduling
 * - MIDI Export to Track Arranger
 */

class DrumMachine {
  constructor() {
    this.steps = 16;
    this.maxSteps = 32;
    this.currentStep = 0;
    this.isPlaying = false;
    this.bpm = 120;
    this.swing = 0; // 0 to 0.6
    this.volume = 0.85;
    this.containerEl = null;

    // Pattern Banks: A, B, C, D
    this.activeBank = 'A';
    this.songMode = false;
    this.songChain = ['A', 'A', 'B', 'A'];
    this.songChainIndex = 0;

    // Web Audio Lookahead Scheduler state
    this.schedulerTimerId = null;
    this.nextStepTime = 0.0;
    this.scheduleAheadSec = 0.12;
    this.lookaheadMs = 25;

    // Voice Definitions (11 Pro Drum Channels)
    this.voiceDefs = [
      { id: 'kick', name: 'Kick Drum', color: '#EF4444' },
      { id: 'snare', name: 'Snare Drum', color: '#F97316' },
      { id: 'closed_hat', name: 'Closed Hi-Hat', color: '#FBBF24' },
      { id: 'open_hat', name: 'Open Hi-Hat', color: '#34D399' },
      { id: 'clap', name: 'Hand Clap', color: '#10B981' },
      { id: 'rimshot', name: 'Rimshot', color: '#06B6D4' },
      { id: 'high_tom', name: 'High Tom', color: '#6366F1' },
      { id: 'low_tom', name: 'Low Tom', color: '#8B5CF6' },
      { id: 'crash', name: 'Crash Cymbal', color: '#EC4899' },
      { id: 'ride', name: 'Ride Cymbal', color: '#F43F5E' },
      { id: 'perc', name: 'Perc / Shaker', color: '#A855F7' }
    ];

    // Initialize Bank Data Structures
    this.banks = {
      A: this._createEmptyBank(),
      B: this._createEmptyBank(),
      C: this._createEmptyBank(),
      D: this._createEmptyBank()
    };

    // Load initial stock patterns into Bank A
    this._loadInitialPatterns();

    // Groove Presets
    this.groovePresets = {
      straight: { name: 'Straight (No Swing)', swing: 0.0 },
      light: { name: 'Light 16th (15%)', swing: 0.15 },
      medium: { name: 'Medium 16th (30%)', swing: 0.30 },
      heavy: { name: 'Heavy 16th (50%)', swing: 0.50 },
      mpc: { name: 'MPC 60 / 3000 (58%)', swing: 0.58 }
    };
    this.selectedGroove = 'straight';

    // Channel states (Mute/Solo)
    this.voiceStates = {};
    this.voiceDefs.forEach(v => {
      this.voiceStates[v.id] = { mute: false, solo: false, gain: 0.9 };
    });
  }

  _createEmptyBank() {
    const bank = {};
    this.voiceDefs.forEach(v => {
      bank[v.id] = Array.from({ length: 32 }, () => ({
        active: false,
        velocity: 100, // 0 - 127
        probability: 100 // 0 - 100%
      }));
    });
    return bank;
  }

  _loadInitialPatterns() {
    const A = this.banks.A;
    // Standard 4-on-the-floor House / Pop Groove
    [0, 4, 8, 12].forEach(s => { A.kick[s].active = true; A.kick[s].velocity = 115; });
    [4, 12].forEach(s => { A.snare[s].active = true; A.snare[s].velocity = 110; });
    [4, 12].forEach(s => { A.clap[s].active = true; A.clap[s].velocity = 95; });
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(s => { A.closed_hat[s].active = true; A.closed_hat[s].velocity = 85; });
    [2, 6, 10, 14].forEach(s => { A.open_hat[s].active = true; A.open_hat[s].velocity = 90; });
    [0, 8].forEach(s => { A.crash[s].active = (s === 0); A.crash[s].velocity = 95; });

    // Bank B: Funky Hip-Hop / Breakbeat
    const B = this.banks.B;
    [0, 6, 10].forEach(s => { B.kick[s].active = true; B.kick[s].velocity = 120; });
    [4, 12].forEach(s => { B.snare[s].active = true; B.snare[s].velocity = 110; });
    [7, 15].forEach(s => { B.rimshot[s].active = true; B.rimshot[s].velocity = 85; });
    for (let s = 0; s < 16; s++) {
      B.closed_hat[s].active = true;
      B.closed_hat[s].velocity = (s % 2 === 0) ? 95 : 65;
    }
    [11, 14].forEach(s => { B.low_tom[s].active = true; B.low_tom[s].velocity = 90; });
    [3, 9].forEach(s => { B.perc[s].active = true; B.perc[s].velocity = 80; });
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  setSteps(stepCount) {
    if (stepCount !== 16 && stepCount !== 32) return;
    this.steps = stepCount;
    this.render();
  }

  selectBank(bankId) {
    if (!this.banks[bankId]) return;
    this.activeBank = bankId;
    this.render();
  }

  setGroove(presetKey) {
    if (this.groovePresets[presetKey]) {
      this.selectedGroove = presetKey;
      this.swing = this.groovePresets[presetKey].swing;
    }
  }

  toggleMute(voiceId) {
    if (!this.voiceStates[voiceId]) return;
    this.voiceStates[voiceId].mute = !this.voiceStates[voiceId].mute;
    this.render();
  }

  toggleSolo(voiceId) {
    if (!this.voiceStates[voiceId]) return;
    this.voiceStates[voiceId].solo = !this.voiceStates[voiceId].solo;
    this.render();
  }

  isVoiceAudible(voiceId) {
    const states = this.voiceStates;
    const anySolo = Object.values(states).some(s => s.solo);
    if (anySolo) {
      return states[voiceId] && states[voiceId].solo;
    }
    return states[voiceId] ? !states[voiceId].mute : true;
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'drum-programmer-container';

    // Toolbar (Bank Selector, 16/32 Steps, Groove Preset, Song Mode, Clear, Export to Track)
    const toolbar = document.createElement('div');
    toolbar.className = 'drum-programmer-toolbar';
    toolbar.innerHTML = `
      <div class="drum-toolbar-group">
        <span class="drum-toolbar-label">BANK:</span>
        ${['A', 'B', 'C', 'D'].map(b => `
          <button class="drum-bank-btn ${this.activeBank === b ? 'active' : ''}" data-bank="${b}">${b}</button>
        `).join('')}
      </div>

      <div class="drum-toolbar-group">
        <span class="drum-toolbar-label">STEPS:</span>
        <button class="drum-stepcount-btn ${this.steps === 16 ? 'active' : ''}" data-steps="16">16</button>
        <button class="drum-stepcount-btn ${this.steps === 32 ? 'active' : ''}" data-steps="32">32</button>
      </div>

      <div class="drum-toolbar-group">
        <span class="drum-toolbar-label">GROOVE:</span>
        <select class="drum-groove-select">
          ${Object.entries(this.groovePresets).map(([k, v]) => `
            <option value="${k}" ${this.selectedGroove === k ? 'selected' : ''}>${v.name}</option>
          `).join('')}
        </select>
      </div>

      <div class="drum-toolbar-group">
        <button class="drum-songmode-btn ${this.songMode ? 'active' : ''}">Song Mode: ${this.songMode ? 'ON' : 'OFF'}</button>
        <button class="drum-clear-btn">Clear Bank</button>
        <button class="drum-export-track-btn" title="Convert drum pattern to Arranger MIDI Track">⤓ To Track</button>
      </div>
    `;

    // Bind toolbar events
    toolbar.querySelectorAll('.drum-bank-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectBank(btn.dataset.bank));
    });
    toolbar.querySelectorAll('.drum-stepcount-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setSteps(parseInt(btn.dataset.steps, 10)));
    });
    const grooveSelect = toolbar.querySelector('.drum-groove-select');
    grooveSelect.addEventListener('change', (e) => this.setGroove(e.target.value));

    const songModeBtn = toolbar.querySelector('.drum-songmode-btn');
    songModeBtn.addEventListener('click', () => {
      this.songMode = !this.songMode;
      songModeBtn.classList.toggle('active', this.songMode);
      songModeBtn.textContent = `Song Mode: ${this.songMode ? 'ON' : 'OFF'}`;
      this.render();
    });

    const clearBtn = toolbar.querySelector('.drum-clear-btn');
    clearBtn.addEventListener('click', () => {
      if (confirm(`Clear all steps in Bank ${this.activeBank}?`)) {
        this.clearBank(this.activeBank);
      }
    });

    const exportBtn = toolbar.querySelector('.drum-export-track-btn');
    exportBtn.addEventListener('click', () => this.exportPatternToTrack());

    root.appendChild(toolbar);

    // Song mode chain bar if active
    if (this.songMode) {
      const chainBar = document.createElement('div');
      chainBar.className = 'drum-chain-bar';
      chainBar.innerHTML = `
        <span class="chain-label">Pattern Chain:</span>
        <div class="chain-slots">
          ${this.songChain.map((b, idx) => `
            <span class="chain-slot ${idx === this.songChainIndex && this.isPlaying ? 'current-chain' : ''}" data-idx="${idx}">
              ${b}
              <button class="chain-del-btn" data-idx="${idx}">×</button>
            </span>
          `).join('')}
        </div>
        <button class="chain-add-btn">+ Append Bank</button>
      `;

      chainBar.querySelectorAll('.chain-del-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(b.dataset.idx, 10);
          if (this.songChain.length > 1) {
            this.songChain.splice(idx, 1);
            this.render();
          }
        });
      });

      chainBar.querySelector('.chain-add-btn').addEventListener('click', () => {
        this.songChain.push(this.activeBank);
        this.render();
      });

      root.appendChild(chainBar);
    }

    // Grid Container
    const grid = document.createElement('div');
    grid.className = 'drum-sequencer-grid';

    // Header row with step numbers
    const headerRow = document.createElement('div');
    headerRow.className = 'drum-row drum-header-row';
    headerRow.innerHTML = `<div class="drum-channel-label">VOICE / M / S</div>`;
    const stepsHeader = document.createElement('div');
    stepsHeader.className = 'steps-container';
    for (let s = 0; s < this.steps; s++) {
      const stepBadge = document.createElement('div');
      stepBadge.className = `step-indicator-badge ${s % 4 === 0 ? 'downbeat' : ''} ${s % 16 === 0 ? 'bar-start' : ''}`;
      stepBadge.dataset.step = s;
      stepBadge.textContent = s + 1;
      stepsHeader.appendChild(stepBadge);
    }
    headerRow.appendChild(stepsHeader);
    grid.appendChild(headerRow);

    // Voice Rows (11 Voices)
    const currentBankData = this.banks[this.activeBank];

    this.voiceDefs.forEach(voice => {
      const row = document.createElement('div');
      row.className = 'drum-row';

      // Channel Control Label
      const label = document.createElement('div');
      label.className = 'drum-channel-label';
      const isMuted = this.voiceStates[voice.id].mute;
      const isSolo = this.voiceStates[voice.id].solo;

      label.innerHTML = `
        <span class="drum-color-dot" style="background: ${voice.color}"></span>
        <span class="drum-name" title="${voice.name}">${voice.name}</span>
        <button class="drum-v-btn mute-btn ${isMuted ? 'active' : ''}" title="Mute Voice">M</button>
        <button class="drum-v-btn solo-btn ${isSolo ? 'active' : ''}" title="Solo Voice">S</button>
        <button class="drum-audition-btn" title="Preview Sound">▶</button>
      `;

      label.querySelector('.mute-btn').addEventListener('click', () => this.toggleMute(voice.id));
      label.querySelector('.solo-btn').addEventListener('click', () => this.toggleSolo(voice.id));
      label.querySelector('.drum-audition-btn').addEventListener('click', () => {
        window.audioEngine.ensureContext().then(() => {
          this.triggerDrumVoice(voice.id, 0.9, window.audioEngine.ctx.currentTime);
        });
      });

      // Step Buttons
      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'steps-container';
      const patternData = currentBankData[voice.id];

      for (let s = 0; s < this.steps; s++) {
        const step = patternData[s];
        const stepBtn = document.createElement('button');
        const isActive = step.active;

        stepBtn.className = `drum-step-btn ${isActive ? 'active' : ''} ${s % 4 === 0 ? 'beat-start' : ''} ${s % 16 === 0 ? 'bar-start' : ''}`;
        stepBtn.dataset.voice = voice.id;
        stepBtn.dataset.step = s;
        if (isActive) {
          stepBtn.style.backgroundColor = voice.color;
          stepBtn.style.opacity = Math.max(0.4, step.velocity / 127);
        }

        // Left Click: Toggle Active
        stepBtn.addEventListener('click', (e) => {
          if (e.shiftKey) {
            // Shift click: prompt for velocity and probability
            const vel = prompt('Step Velocity (1-127):', step.velocity);
            if (vel !== null) step.velocity = Math.max(1, Math.min(127, parseInt(vel, 10) || 100));
            const prob = prompt('Step Probability % (0-100):', step.probability);
            if (prob !== null) step.probability = Math.max(0, Math.min(100, parseInt(prob, 10) || 100));
            step.active = true;
            stepBtn.classList.add('active');
            stepBtn.style.backgroundColor = voice.color;
            stepBtn.style.opacity = Math.max(0.4, step.velocity / 127);
            return;
          }

          step.active = !step.active;
          stepBtn.classList.toggle('active', step.active);
          stepBtn.style.backgroundColor = step.active ? voice.color : '';
          stepBtn.style.opacity = step.active ? Math.max(0.4, step.velocity / 127) : '';

          // Audition on click if activated
          if (step.active) {
            window.audioEngine.ensureContext().then(() => {
              this.triggerDrumVoice(voice.id, step.velocity / 127, window.audioEngine.ctx.currentTime);
            });
          }
        });

        // Context Menu for quick velocity adjustments
        stepBtn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const newVel = prompt(`Step ${s + 1} Velocity [1-127]:`, step.velocity);
          if (newVel !== null) {
            step.velocity = Math.max(1, Math.min(127, parseInt(newVel, 10) || 100));
            if (step.active) stepBtn.style.opacity = Math.max(0.4, step.velocity / 127);
          }
        });

        stepsDiv.appendChild(stepBtn);
      }

      row.appendChild(label);
      row.appendChild(stepsDiv);
      grid.appendChild(row);
    });

    root.appendChild(grid);
    this.containerEl.appendChild(root);
  }

  clearBank(bankId) {
    if (!this.banks[bankId]) return;
    this.banks[bankId] = this._createEmptyBank();
    this.render();
  }

  loadPreset(presetName) {
    this.clearBank(this.activeBank);
    const B = this.banks[this.activeBank];

    if (presetName === 'rock') {
      [0, 8].forEach(s => { B.kick[s].active = true; B.kick[s].velocity = 115; });
      [4, 12].forEach(s => { B.snare[s].active = true; B.snare[s].velocity = 110; });
      for (let s = 0; s < 16; s += 2) { B.closed_hat[s].active = true; B.closed_hat[s].velocity = 85; }
      [14].forEach(s => { B.open_hat[s].active = true; B.open_hat[s].velocity = 90; });
      [0].forEach(s => { B.crash[s].active = true; B.crash[s].velocity = 100; });
    } else if (presetName === 'hiphop') {
      [0, 6, 10].forEach(s => { B.kick[s].active = true; B.kick[s].velocity = 120; });
      [4, 12].forEach(s => { B.snare[s].active = true; B.snare[s].velocity = 110; });
      [4, 12].forEach(s => { B.clap[s].active = true; B.clap[s].velocity = 90; });
      for (let s = 0; s < 16; s++) { B.closed_hat[s].active = true; B.closed_hat[s].velocity = (s % 2 === 0) ? 90 : 60; }
      [7].forEach(s => { B.rimshot[s].active = true; B.rimshot[s].velocity = 80; });
    } else if (presetName === 'house') {
      [0, 4, 8, 12].forEach(s => { B.kick[s].active = true; B.kick[s].velocity = 115; });
      [4, 12].forEach(s => { B.snare[s].active = true; B.snare[s].velocity = 105; });
      [2, 6, 10, 14].forEach(s => { B.open_hat[s].active = true; B.open_hat[s].velocity = 95; });
      [4, 12].forEach(s => { B.clap[s].active = true; B.clap[s].velocity = 90; });
      [0, 8].forEach(s => { B.ride[s].active = true; B.ride[s].velocity = 75; });
    } else if (presetName === 'jazz') {
      [0, 8].forEach(s => { B.kick[s].active = true; B.kick[s].velocity = 80; });
      [0, 3, 6, 8, 11, 14].forEach(s => { B.ride[s].active = true; B.ride[s].velocity = 85; });
      [4, 12].forEach(s => { B.closed_hat[s].active = true; B.closed_hat[s].velocity = 75; });
      [7, 15].forEach(s => { B.rimshot[s].active = true; B.rimshot[s].velocity = 70; });
    }
    this.render();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  async play() {
    await window.audioEngine.ensureContext();
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.songChainIndex = 0;

    const ctx = window.audioEngine.ctx;
    this.nextStepTime = ctx.currentTime + 0.05;

    const playBtn = document.getElementById('drum-play-btn');
    if (playBtn) {
      playBtn.classList.add('playing');
      playBtn.innerHTML = '⏸ Stop Beat';
    }

    // Start precision Web Audio clock scheduler loop
    this._schedulerLoop();
  }

  stop() {
    this.isPlaying = false;
    if (this.schedulerTimerId) {
      clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
    this._clearStepHighlights();

    const playBtn = document.getElementById('drum-play-btn');
    if (playBtn) {
      playBtn.classList.remove('playing');
      playBtn.innerHTML = '▶ Play Beat';
    }
  }

  _schedulerLoop() {
    if (!this.isPlaying) return;

    const ctx = window.audioEngine.ctx;
    const bpm = window.trackManager ? window.trackManager.bpm : this.bpm;
    const stepDuration = 60 / bpm / 4; // 16th note in seconds

    // Schedule events in lookahead window
    while (this.nextStepTime < ctx.currentTime + this.scheduleAheadSec) {
      this._scheduleStep(this.currentStep, this.nextStepTime);
      this._advanceStep(stepDuration);
    }

    this.schedulerTimerId = setTimeout(() => this._schedulerLoop(), this.lookaheadMs);
  }

  _advanceStep(stepDuration) {
    // Apply swing offset to odd steps
    const isOdd = this.currentStep % 2 !== 0;
    const swingSec = isOdd ? (this.swing * 0.3 * stepDuration) : 0;
    this.nextStepTime += stepDuration + swingSec;

    this.currentStep++;
    if (this.currentStep >= this.steps) {
      this.currentStep = 0;

      // Handle song mode pattern chaining
      if (this.songMode && this.songChain.length > 0) {
        this.songChainIndex = (this.songChainIndex + 1) % this.songChain.length;
        this.activeBank = this.songChain[this.songChainIndex];
        // Request UI render update
        setTimeout(() => this.render(), 0);
      }
    }
  }

  _scheduleStep(stepIndex, audioTime) {
    const ctx = window.audioEngine.ctx;
    const bank = this.banks[this.activeBank];
    if (!bank) return;

    // Trigger audible voices
    this.voiceDefs.forEach(voice => {
      if (!this.isVoiceAudible(voice.id)) return;
      const stepData = bank[voice.id][stepIndex];
      if (!stepData || !stepData.active) return;

      // Probability check
      if (stepData.probability < 100) {
        const roll = Math.random() * 100;
        if (roll > stepData.probability) return;
      }

      const velocity = (stepData.velocity / 127) * (this.voiceStates[voice.id].gain || 0.9);
      this.triggerDrumVoice(voice.id, velocity, audioTime);
    });

    // Schedule visual highlight using time difference
    const delayMs = Math.max(0, (audioTime - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isPlaying) {
        this._highlightCurrentStep(stepIndex);
      }
    }, delayMs);
  }

  _highlightCurrentStep(stepIdx) {
    if (!this.containerEl) return;
    this._clearStepHighlights();

    // Step Header
    const badge = this.containerEl.querySelector(`.step-indicator-badge[data-step="${stepIdx}"]`);
    if (badge) badge.classList.add('current');

    // Matrix buttons
    const btns = this.containerEl.querySelectorAll(`.drum-step-btn[data-step="${stepIdx}"]`);
    btns.forEach(btn => btn.classList.add('playing-step'));
  }

  _clearStepHighlights() {
    if (!this.containerEl) return;
    this.containerEl.querySelectorAll('.step-indicator-badge.current').forEach(b => b.classList.remove('current'));
    this.containerEl.querySelectorAll('.drum-step-btn.playing-step').forEach(b => b.classList.remove('playing-step'));
  }

  /**
   * High-fidelity 11-voice drum synthesis engine
   */
  triggerDrumVoice(drumId, velocity = 0.85, startTime = null) {
    const ctx = window.audioEngine.ctx;
    if (!ctx) return;
    const dest = window.audioEngine.destinationNode;
    const t = (startTime !== null && startTime >= ctx.currentTime) ? startTime : ctx.currentTime;
    const vel = Math.max(0.01, Math.min(1.0, velocity));

    switch (drumId) {
      case 'kick': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(155, t);
        osc.frequency.exponentialRampToValueAtTime(36, t + 0.12);
        gain.gain.setValueAtTime(vel * 1.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      }

      case 'snare': {
        // Tonal shell body
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(210, t);
        osc.frequency.exponentialRampToValueAtTime(95, t + 0.08);
        oscGain.gain.setValueAtTime(vel * 0.75, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(oscGain);
        oscGain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.17);

        // White noise wire snap
        const noiseBuf = this._getWhiteNoiseBuffer(0.2);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, t);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(vel * 0.85, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(dest);
        noise.start(t);
        break;
      }

      case 'closed_hat': {
        const noiseBuf = this._getWhiteNoiseBuffer(0.06);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(9000, t);
        filter.Q.setValueAtTime(3.5, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vel * 0.65, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        source.start(t);
        break;
      }

      case 'open_hat': {
        const noiseBuf = this._getWhiteNoiseBuffer(0.4);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(6800, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vel * 0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        source.start(t);
        break;
      }

      case 'clap': {
        // Multi-tap noise burst envelope
        const noiseBuf = this._getWhiteNoiseBuffer(0.25);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, t);
        filter.Q.setValueAtTime(1.8, t);
        const gain = ctx.createGain();

        // 3 mini bursts then tail
        gain.gain.setValueAtTime(0, t);
        gain.gain.setValueAtTime(vel * 0.7, t + 0.01);
        gain.gain.setValueAtTime(0.01, t + 0.015);
        gain.gain.setValueAtTime(vel * 0.8, t + 0.025);
        gain.gain.setValueAtTime(0.01, t + 0.03);
        gain.gain.setValueAtTime(vel * 0.9, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        source.start(t);
        break;
      }

      case 'rimshot': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(350, t + 0.04);
        gain.gain.setValueAtTime(vel * 0.85, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.055);
        break;
      }

      case 'high_tom':
      case 'low_tom': {
        const startFreq = drumId === 'low_tom' ? 125 : 210;
        const endFreq = drumId === 'low_tom' ? 42 : 80;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.22);
        gain.gain.setValueAtTime(vel * 0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.34);
        break;
      }

      case 'crash': {
        const noiseBuf = this._getWhiteNoiseBuffer(1.2);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(4500, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vel * 0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        source.start(t);
        break;
      }

      case 'ride': {
        // Metallic ping + sustained shimmer
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3200, t);
        oscGain.gain.setValueAtTime(vel * 0.45, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(oscGain);
        oscGain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.46);

        const noiseBuf = this._getWhiteNoiseBuffer(0.6);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(8000, t);
        filter.Q.setValueAtTime(5, t);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(vel * 0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(dest);
        source.start(t);
        break;
      }

      case 'perc': {
        // Textured shaker / latin conga slap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, t);
        osc.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        gain.gain.setValueAtTime(vel * 0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.19);
        break;
      }
    }
  }

  _getWhiteNoiseBuffer(durationSec) {
    const ctx = window.audioEngine.ctx;
    const len = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /**
   * Convert current drum bank into a MIDI track in TrackManager
   */
  exportPatternToTrack() {
    if (!window.trackManager) {
      alert('Track Manager is not available.');
      return;
    }

    const bank = this.banks[this.activeBank];
    const bpm = window.trackManager.bpm || 120;
    const stepDurationMs = (60 / bpm / 4) * 1000;

    // Map drum voices to standard GM Drum MIDI note numbers
    const midiPitchMap = {
      kick: 36, // C1
      rimshot: 37, // C#1
      snare: 38, // D1
      clap: 39, // D#1
      low_tom: 45, // A1
      closed_hat: 42, // F#1
      open_hat: 46, // A#1
      high_tom: 50, // D2
      crash: 49, // C#2
      ride: 51, // D#2
      perc: 54 // F#2
    };

    const notes = [];

    this.voiceDefs.forEach(voice => {
      const pitch = midiPitchMap[voice.id] || 36;
      const pattern = bank[voice.id];
      for (let s = 0; s < this.steps; s++) {
        const step = pattern[s];
        if (step && step.active) {
          notes.push({
            id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            midiNote: pitch,
            startTimeMs: Math.round(s * stepDurationMs),
            durationMs: Math.round(stepDurationMs * 0.8),
            velocity: (step.velocity / 127) * 0.9
          });
        }
      }
    });

    if (notes.length === 0) {
      alert('Current pattern has no active drum hits to export.');
      return;
    }

    const trackName = `Drums (Bank ${this.activeBank})`;
    // Add track to trackManager
    const newTrack = window.trackManager.createTrack('standard_drum_kit', trackName);
    if (newTrack) {
      newTrack.events = notes;
      newTrack.notes = notes;
      window.trackManager.renderArrangerUI();
      alert(`Exported drum pattern to new track: "${trackName}"!`);
    }
  }

  // State serialization for IndexedDB persistence
  toJSON() {
    return {
      activeBank: this.activeBank,
      steps: this.steps,
      selectedGroove: this.selectedGroove,
      swing: this.swing,
      songMode: this.songMode,
      songChain: this.songChain,
      banks: this.banks
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.activeBank) this.activeBank = data.activeBank;
    if (data.steps) this.steps = data.steps;
    if (data.selectedGroove) this.selectedGroove = data.selectedGroove;
    if (data.swing !== undefined) this.swing = data.swing;
    if (data.songMode !== undefined) this.songMode = data.songMode;
    if (data.songChain) this.songChain = data.songChain;
    if (data.banks) this.banks = data.banks;
    this.render();
  }
}

window.drumMachine = new DrumMachine();
