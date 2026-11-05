/**
 * Virtual Music Studio - Audio Engine
 * Core Web Audio API graph, master bus, analyser, voice manager, and DSP pipeline.
 * Fully compliant with browser Autoplay Policy & Centralized Asynchronous Unlock.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.isMuted = false;
    this.volume = 0.85;
    this.activeVoices = new Map();
    this.isInitialized = false;
    this.isUnlocked = false;
    this.isUnlocking = false;
    this.unlockPromise = null;
    this.onStateChangeCallbacks = [];
    this.effects = null;
    this.destinationNode = null;
    this.mediaStreamDestination = null;
    this.cpuLoad = 0;
    this.lastCpuSample = performance.now();
  }

  /**
   * Centralized asynchronous audio initialization and unlock.
   * MUST be invoked following a user gesture (button click, piano key, keyboard press).
   */
  async unlockAudio() {
    // If already running and unlocked, return existing context
    if (this.ctx && this.ctx.state === 'running') {
      this.isUnlocked = true;
      this.isInitialized = true;
      this._updateAudioStateUI();
      return this.ctx;
    }

    if (this.isUnlocking && this.unlockPromise) {
      return this.unlockPromise;
    }

    this.isUnlocking = true;

    this.unlockPromise = (async () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('Web Audio API is not supported in this browser.');
        }

        // 1. Prevent duplicate AudioContext creation
        if (!this.ctx || this.ctx.state === 'closed') {
          console.log('[AudioEngine] Creating single AudioContext instance...');
          this.ctx = new AudioContextClass({
            latencyHint: 'interactive',
            sampleRate: 44100
          });
          this._setupAudioGraph();
          this._bindContextStateListener();
        }

        // 2. Call resume() directly on the user interaction thread before other async awaits
        if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
          console.log(`[AudioEngine] Resuming AudioContext from state: "${this.ctx.state}"...`);
          await this.ctx.resume();
        }

        // 3. Verify state
        if (this.ctx.state === 'running') {
          console.log('[AudioEngine] AudioContext is now RUNNING. Sample rate:', this.ctx.sampleRate, 'Hz');
          this.isInitialized = true;
          this.isUnlocked = true;
        } else {
          console.warn('[AudioEngine] AudioContext state after resume is:', this.ctx.state);
        }

        // 4. Initialize WebAudioFont only after AudioContext is running
        if (window.soundFontManager) {
          await window.soundFontManager.init(this.ctx);
          if (window.instrumentManager && window.instrumentManager.currentInstrument) {
            await window.soundFontManager.loadInstrument(window.instrumentManager.currentInstrument);
          }
        }

        this._updateAudioStateUI();
        this._notifyStateChange();

        return this.ctx;
      } catch (err) {
        console.error('[AudioEngine] AudioContext initialization/unlock failed:', err);
        this._updateAudioStateUI();
        throw err;
      } finally {
        this.isUnlocking = false;
      }
    })();

    return this.unlockPromise;
  }

  /**
   * Alias for backward compatibility and note-trigger checks
   */
  async ensureContext() {
    return this.unlockAudio();
  }

  /**
   * Initializes audio graph nodes with the single AudioContext instance
   */
  _setupAudioGraph() {
    if (!this.ctx) return;

    // Media stream destination for high-fidelity audio recording
    this.mediaStreamDestination = this.ctx.createMediaStreamDestination();

    // Initialize Mixer Engine with full multi-track DAW graph
    if (window.mixerEngine) {
      window.mixerEngine.init(this.ctx);
      this.masterGain = window.mixerEngine.masterGain;
      this.analyser = window.mixerEngine.masterAnalyser;
      this.destinationNode = window.mixerEngine.masterSummingBus;
    } else {
      // Fallback Master Gain & Analyser
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.82;

      if (window.studioEffects) {
        this.effects = window.studioEffects;
        this.effects.init(this.ctx, this.masterGain);
        this.destinationNode = this.effects.inputNode;
      } else {
        this.destinationNode = this.masterGain;
      }

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.masterGain.connect(this.mediaStreamDestination);
    }

    this._startCpuMonitoring();
    console.log('[AudioEngine] Audio graph configured with multi-track DAW mixer.');
  }

  /**
   * Binds listener to track suspended, interrupted, and closed states
   */
  _bindContextStateListener() {
    if (!this.ctx) return;

    this.ctx.onstatechange = () => {
      const state = this.ctx ? this.ctx.state : 'uninitialized';
      console.log(`[AudioEngine] AudioContext state changed to: "${state}"`);

      if (state === 'running') {
        this.isUnlocked = true;
      } else if (state === 'suspended' || state === 'interrupted') {
        this.isUnlocked = false;
      } else if (state === 'closed') {
        this.isUnlocked = false;
        this.isInitialized = false;
        this.ctx = null;
      }

      this._updateAudioStateUI();
      this._notifyStateChange();
    };

    // Auto-resume when page becomes visible/focused if previously unlocked
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && this.ctx.state === 'suspended' && this.isUnlocked) {
        this.ctx.resume().catch(e => console.warn('[AudioEngine] Visibility resume notice:', e));
      }
    });

    window.addEventListener('focus', () => {
      if (this.ctx && this.ctx.state === 'suspended' && this.isUnlocked) {
        this.ctx.resume().catch(e => console.warn('[AudioEngine] Focus resume notice:', e));
      }
    });
  }

  /**
   * Updates interface indicators and Enable Audio button
   */
  _updateAudioStateUI() {
    const statusPill = document.getElementById('audio-engine-status');
    const statusText = document.getElementById('audio-status-text');
    const enableBtn = document.getElementById('btn-enable-audio');

    const state = this.ctx ? this.ctx.state : 'locked';

    if (statusPill && statusText) {
      statusPill.className = `audio-status-pill ${state}`;
      if (state === 'running') {
        statusText.textContent = `Audio: Active (${Math.round(this.ctx.sampleRate / 1000)}kHz)`;
        statusPill.title = 'Web Audio Engine is running with full interactive polyphony';
      } else if (state === 'suspended') {
        statusText.textContent = 'Audio: Suspended';
        statusPill.title = 'Click Enable Audio or interact with keyboard to resume';
      } else if (state === 'interrupted') {
        statusText.textContent = 'Audio: Interrupted';
        statusPill.title = 'Audio interrupted by system. Click to resume.';
      } else {
        statusText.textContent = 'Audio: Locked';
        statusPill.title = 'Browser autoplay policy requires a user gesture to enable sound';
      }
    }

    if (enableBtn) {
      if (state === 'running') {
        enableBtn.style.display = 'none';
      } else {
        enableBtn.style.display = 'inline-flex';
        enableBtn.textContent = state === 'suspended' || state === 'interrupted' ? '▶ Resume Audio' : '🔊 Enable Audio';
      }
    }
  }

  setMasterVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
    return this.isMuted;
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  _notifyStateChange() {
    const state = this.ctx ? this.ctx.state : 'locked';
    this.onStateChangeCallbacks.forEach(cb => {
      try { cb(state); } catch (e) { console.error(e); }
    });
  }

  getAnalyserData(array) {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array);
    }
  }

  getWaveformData(array) {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(array);
    }
  }

  _startCpuMonitoring() {
    setInterval(() => {
      if (!this.ctx) return;
      const now = performance.now();
      const elapsed = now - this.lastCpuSample;
      this.lastCpuSample = now;
      const voiceCount = this.activeVoices.size;
      const baseLoad = Math.min(95, Math.floor(voiceCount * 3.5 + (elapsed > 1100 ? 12 : 3) + Math.random() * 2));
      this.cpuLoad = Math.max(1, baseLoad);
      const cpuEl = document.getElementById('cpu-meter-fill');
      const cpuText = document.getElementById('cpu-meter-text');
      if (cpuEl) cpuEl.style.width = `${this.cpuLoad}%`;
      if (cpuText) cpuText.textContent = `${this.cpuLoad}%`;
    }, 1000);
  }
}

// Global singleton instance
window.audioEngine = new AudioEngine();
